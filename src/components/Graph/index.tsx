import { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
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
  const [hoverInfo, setHoverInfo] = useState<{ title: string; description?: string } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

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
        const description: string | null = g.getNodeAttribute(node, "body") ?? null;
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

    // Add nodes
    for (const n of data.nodes) {
      g.addNode(n.id, {
        label: n.title,
        kind: n.kind,
        noteId: n.noteId ?? null,
        body: n.body ?? null,
        size: n.kind === "tag" ? 10 : 8,
        x: Math.random() * 100,
        y: Math.random() * 100,
      });
    }

    // Add edges
    for (const e of data.edges) {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        if (!g.hasEdge(e.source, e.target)) {
          // best-effort unique key
          g.addEdgeWithKey?.(e.id, e.source, e.target) ?? g.addEdge(e.source, e.target);
        }
      }
    }

    s.refresh();
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
        {hoverInfo && mousePos && (
          <div
            className="absolute z-10 max-w-xs rounded-md border border-gray-200 bg-white shadow px-3 py-2 text-xs text-gray-800"
            style={{ left: mousePos.x + 12, top: mousePos.y + 12 }}
          >
            <div><span className="font-semibold">Title:</span> {hoverInfo.title}</div>
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
