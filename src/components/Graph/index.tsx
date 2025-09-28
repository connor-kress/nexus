import { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type GraphPanelProps = {
  projectId?: Id<"projects"> | null;
  onSelectNote?: (noteId: Id<"notes"> | null) => void;
};

function GraphPanel({ projectId, onSelectNote }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fa2Ref = useRef<FA2Layout | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const zoom = (direction: "in" | "out") => {
    const s = sigmaRef.current;
    if (!s) return;
    const camera = s.getCamera();
    const state = camera.getState();
    const factor = direction === "in" ? 1 / 1.2 : 1.2;
    const targetRatio = Math.max(0.01, Math.min(10, state.ratio * factor));
    camera.animate({ ...state, ratio: targetRatio }, { duration: 220 });
  };

  // Periodic refresh can be added by caller via prop changes; simple polling interval left to the app.
  const graphData = useQuery(
    api.notes.graphForProject,
    projectId ? { projectId } : "skip"
  );

  const data = graphData ?? { nodes: [], edges: [] };

  // Initialize Sigma once
  useEffect(() => {
    if (!containerRef.current) return;
    if (!sigmaRef.current) {
      const g = new Graph();
      const s = new Sigma(g, containerRef.current, {
        renderLabels: true,
        allowInvalidContainer: true,
      });
      graphRef.current = g;
      sigmaRef.current = s;

      s.on("clickNode", ({ node }: { node: string }) => {
        const nKind = g.getNodeAttribute(node, "kind");
        const noteId = g.getNodeAttribute(node, "noteId");
        if (nKind === "note" && noteId && onSelectNote) {
          onSelectNote(noteId as Id<"notes">);
        }
      });

      s.on("enterNode", ({ node }: { node: string }) => {
        const nKind = g.getNodeAttribute(node, "kind");
        if (nKind !== "note") return;
        const title: string = g.getNodeAttribute(node, "label");
        const description: string | null =
          g.getNodeAttribute(node, "body") ?? null;
        setHoverInfo({ title, description: description ?? undefined });
      });

      s.on("leaveNode", () => {
        setHoverInfo(null);
      });

      s.on("clickStage", () => {
        if (onSelectNote) onSelectNote(null as unknown as Id<"notes"> | null);
      });
    }

    return () => {
      // Do not kill sigma between renders to preserve layout; unmount handled by parent
    };
  }, [containerRef]);

  // Update graph on data changes
  useEffect(() => {
    const g = graphRef.current;
    const s = sigmaRef.current;
    if (!g || !s) return;

    // Reset graph
    g.clear();

    // & Reset Camera if not already unzoomed
    const camera = s.getCamera();
    const state = camera.getState();
    camera.animate({ ...state, x: 0.5, y: 0.5, ratio: 1 }, { duration: 1500 });

    // Pre-compute layout seeding
    const tags = data.nodes.filter((n) => n.kind === "tag");
    const notes = data.nodes.filter((n) => n.kind !== "tag");

    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(80, Math.min(width, height) * 0.38);

    const seedPos: Record<string, { x: number; y: number }> = {};

    // Place tag nodes on a circle for clear separation
    const tagCount = Math.max(1, tags.length);
    const angles: Record<string, number> = {};
    tags.forEach((t, i) => {
      angles[t.id] = (2 * Math.PI * i) / tagCount;
    });

    // Build quick adjacency from data.edges for note->tag link lookup
    const noteToTagPositions: Record<
      string,
      Array<{ x: number; y: number }>
    > = {};
    for (const e of data.edges) {
      // for each edge, if one side is a tag and the other is a note, record tag position
      const sourceNode = data.nodes.find((n) => n.id === e.source);
      const targetNode = data.nodes.find((n) => n.id === e.target);
      if (!sourceNode || !targetNode) continue;
      if (sourceNode.kind === "tag" && targetNode.kind !== "tag") {
        const p = seedPos[sourceNode.id];
        if (p) {
          (noteToTagPositions[targetNode.id] ||= []).push(p);
        }
      } else if (targetNode.kind === "tag" && sourceNode.kind !== "tag") {
        const p = seedPos[targetNode.id];
        if (p) {
          (noteToTagPositions[sourceNode.id] ||= []).push(p);
        }
      }
    }

    // Place note nodes near the barycenter of their tag neighbors with slight outward offset
    notes.forEach((n) => {
      const neighbors = noteToTagPositions[n.id];
      if (neighbors && neighbors.length > 0) {
        const avg = neighbors.reduce(
          (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
          { x: 0, y: 0 }
        );
        const bx = avg.x / neighbors.length;
        const by = avg.y / neighbors.length;
        // slight outward offset from center to avoid being too close to tags
        let dx = bx - cx;
        let dy = by - cy;
        let d = Math.hypot(dx, dy);
        if (d < 1e-3) {
          const theta = Math.random() * Math.PI * 2;
          dx = Math.cos(theta);
          dy = Math.sin(theta);
          d = 1;
        }
        const ux = dx / d;
        const uy = dy / d;
        const sep = Math.max(64, Math.min(width, height) * 0.65);
        const jitter = 12;
        seedPos[n.id] = {
          x: bx + ux * sep + (Math.random() - 0.5) * jitter,
          y: by + uy * sep + (Math.random() - 0.5) * jitter,
        };
      } else {
        // fallback: near center with mild random spread
        seedPos[n.id] = {
          x: cx + (Math.random() - 0.5) * radius * 0.5,
          y: cy + (Math.random() - 0.5) * radius * 0.5,
        };
      }
    });

    // Add nodes with seeded positions
    for (const n of data.nodes) {
      const pos = seedPos[n.id] ?? {
        x: Math.random() * width,
        y: Math.random() * height,
      };
      g.addNode(n.id, {
        label: n.title,
        kind: n.kind,
        noteId: n.noteId ?? null,
        body: n.body ?? null,
        size: n.kind === "tag" ? 10 : 8,
        x: pos.x,
        y: pos.y,
      });
    }

    // Add edges
    for (const e of data.edges) {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        if (!g.hasEdge(e.source, e.target)) {
          // best-effort unique key
          g.addEdgeWithKey?.(e.id, e.source, e.target) ??
            g.addEdge(e.source, e.target);
        }
      }
    }

    s.refresh();

    // Start / restart ForceAtlas2 layout without edge weights
    if (fa2Ref.current) {
      try {
        fa2Ref.current.stop();
        fa2Ref.current.kill();
      } catch (_) {}
      fa2Ref.current = null;
    }

    const layout = new FA2Layout(g, {
      settings: {
        // ignore edge weights entirely
        edgeWeightInfluence: 0,
        // prevent node overlap by size, keep tags spread out
        adjustSizes: true,
        // LinLog tends to separate clusters while keeping intra-cluster distances tighter
        linLogMode: true,
        // reduce pull of high-degree tags to keep notes further out
        outboundAttractionDistribution: true,
        barnesHutOptimize: true,
        barnesHutTheta: 0.7,
        gravity: 0.06,
        // slightly higher repulsion for more even tag spacing
        scalingRatio: 20,
        // slowDown stabilizes iterations and reduces oscillations
        slowDown: 15,
      },
      // ensure no per-edge weight function is read
      getEdgeWeight: null,
      outputReducer: (key, attrs) => attrs,
    });
    fa2Ref.current = layout;
    layout.start();

    // Stop the layout after some iterations/time to stabilize
    const stopId = window.setTimeout(() => {
      try {
        layout.stop();
      } catch (_) {}
      s.refresh();
    }, 1500);

    return () => {
      window.clearTimeout(stopId);
      try {
        layout.stop();
        layout.kill();
      } catch (_) {}
      if (fa2Ref.current === layout) fa2Ref.current = null;
    };
  }, [data.nodes, data.edges]);

  return (
    <div className="h-full w-full overflow-auto p-3">
      <div className="text-sm font-medium text-gray-600 mb-2">Graph</div>
      <div
        ref={containerRef}
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        className="h-full rounded-xl border border-gray-200 bg-white shadow-sm relative"
      >
        <div className="absolute right-3 bottom-6 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoom("in");
            }}
            className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-700 shadow hover:bg-gray-50 focus:outline-none"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoom("out");
            }}
            className="h-8 w-8 rounded-md border border-gray-300 bg-white text-gray-700 shadow hover:bg-gray-50 focus:outline-none"
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
        </div>
        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const s = sigmaRef.current;
              if (!s) return;
              const camera = s.getCamera();
              const state = camera.getState();
              camera.animate(
                { ...state, x: 0.5, y: 0.5, ratio: 1 }, // no thanks to AI this took me 2 hours to figure out
                { duration: 1500 }
              );
            }}
            className="h-8 px-2 rounded-md border border-gray-300 bg-white text-gray-700 shadow hover:bg-gray-50 focus:outline-none"
            aria-label="Reset view"
            title="Reset view"
          >
            Reset
          </button>
        </div>
        {hoverInfo && mousePos && (
          <div
            className="absolute z-10 max-w-xs rounded-md border border-gray-200 bg-white shadow px-3 py-2 text-xs text-gray-800"
            style={{ left: mousePos.x + 12, top: mousePos.y + 12 }}
          >
            <div>
              <span className="font-semibold">Title:</span> {hoverInfo.title}
            </div>
            {hoverInfo.description ? (
              <div className="mt-1">
                <span className="font-semibold">Description:</span>{" "}
                {hoverInfo.description.length > 100
                  ? hoverInfo.description.slice(0, 100) + "…"
                  : hoverInfo.description}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default GraphPanel;
