// app/components/NodeSummary.tsx
"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { NodeCard, type NodeItem } from "./NodeCard";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import TagsMultiSelect from "./TagsMultiSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// @ts-ignore - no types for react-colorful in this project
import { HslColorPicker } from "react-colorful";

type Props = {
  projectId: Id<"projects"> | null;
  proposedNodes?: NodeItem[];
  acceptedNodes?: NodeItem[];
  onSaveOne?: (id: string) => Promise<void> | void;
  onRejectOne?: (id: string) => Promise<void> | void;
  onSaveMany?: (ids: string[]) => Promise<void> | void;
  className?: string;
  selectedNoteId?: Id<"notes"> | null;
  selectedTagName?: string | null;
  onClear?: () => void;
};

export default function NodeSummaryPanel({
  projectId,
  proposedNodes = [],
  acceptedNodes = [],
  onSaveOne,
  onRejectOne,
  onSaveMany,
  className,
  selectedNoteId,
  selectedTagName,
  onClear,
}: Props) {
  const [tab, setTab] = React.useState<"proposed" | "accepted" | "tabs">("proposed");
  const [savingAll, setSavingAll] = React.useState(false);
  const [rejectingAll, setRejectingAll] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

  // Tabs are now persistent; do not auto-switch based on selectedTagName

  const notesWithTags =
    useQuery(api.notes.listWithTags, projectId ? { projectId } : "skip") ?? [];

  const noteIdToTagNames = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const nt of notesWithTags) {
      m.set(
        String(nt.note._id),
        nt.tags.map((t) => t.name)
      );
    }
    return m;
  }, [notesWithTags]);

  const allTagNames = React.useMemo(() => {
    const s = new Set<string>();
    for (const nt of notesWithTags) for (const t of nt.tags) s.add(t.name);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [notesWithTags]);

  const matches = React.useCallback(
    (node: NodeItem) => {
      if (!selectedTags.length) return true;
      const tags = noteIdToTagNames.get(String(node.id)) ?? [];
      return selectedTags.every((t) => tags.includes(t));
    },
    [noteIdToTagNames, selectedTags]
  );

  const filteredProposed = React.useMemo(
    () => proposedNodes.filter(matches),
    [proposedNodes, matches]
  );
  const filteredAccepted = React.useMemo(
    () => acceptedNodes.filter(matches),
    [acceptedNodes, matches]
  );

  const handleSaveAll = async () => {
    if (!filteredProposed?.length) return;
    try {
      setSavingAll(true);
      if (onSaveMany) {
        await onSaveMany(filteredProposed.map((n) => n.id));
      } else if (onSaveOne) {
        // Fallback: call per-item if bulk handler not provided
        for (const n of filteredProposed) await onSaveOne(n.id);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const handleRejectAll = async () => {
    if (!filteredProposed?.length || !onRejectOne) return;
    try {
      setRejectingAll(true);
      for (const n of filteredProposed) await onRejectOne(n.id);
    } finally {
      setRejectingAll(false);
    }
  };

  const data = useQuery(
    api.notes.getWithTags,
    selectedNoteId ? { id: selectedNoteId } : "skip"
  );
  const updateBody = useMutation(api.notes.updateBody);
  const [bodyDraft, setBodyDraft] = React.useState<string>("");

  const note = data?.note;
  const tags = data?.tags ?? [];

  // Colors tab helpers
  const projectTags = useQuery(
    api.tags.listByProject,
    projectId ? { projectId } : "skip"
  ) || [];
  const setColor = useMutation(api.tags.setColor);
  const [openPickerTag, setOpenPickerTag] = React.useState<string | null>(null);
  const [hslDraft, setHslDraft] = React.useState<{ h: number; s: number; l: number }>({ h: 200, s: 90, l: 60 });

  const toHex = (r?: number, g?: number, b?: number) => {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const val = (n: number) => clamp(n).toString(16).padStart(2, "0");
    if (r == null || g == null || b == null) return "#4f46e5";
    return `#${val(r)}${val(g)}${val(b)}`;
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  };

  React.useEffect(() => {
    setBodyDraft(note?.body ?? "");
  }, [note?._id, note?.body]);

  const handleSave = async () => {
    if (!note) return;
    if (bodyDraft === note.body) return;
    await updateBody({ id: note._id, body: bodyDraft });
  };

  return (
    <div className={cn("h-full w-full p-3 flex flex-col min-h-0", className)}>
      <div className="flex items-center justify-between mb-2">
        <TagsMultiSelect
          allTags={allTagNames}
          value={selectedTags}
          onChange={setSelectedTags}
        />
      </div>
      <div className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
        {selectedNoteId && note ? (
          <div className="h-full px-3 py-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">Title</div>
                {onClear && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700"
                    onClick={onClear}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="text-sm font-medium text-gray-900">
                {note.title}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {tags.length === 0 ? (
                    <span className="text-xs text-gray-400">No tags</span>
                  ) : (
                    tags.map((t: { _id: Id<"tags">; name: string }) => (
                      <span
                        key={String(t._id)}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                      >
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <textarea
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  rows={8}
                  placeholder="Enter note description..."
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white disabled:opacity-50"
                    disabled={!note || bodyDraft === note.body}
                    onClick={handleSave}
                  >
                    Save
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700"
                    onClick={() => setBodyDraft(note?.body ?? "")}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="border-b px-3 pt-3">
              <TabsList>
                <TabsTrigger value="proposed">
                  Proposed
                  <Badge className="ml-2 text-white">
                    {selectedTags.length
                      ? filteredProposed.length
                      : proposedNodes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="accepted">
                  Accepted
                  <Badge className="ml-2 text-white">
                    {selectedTags.length
                      ? filteredAccepted.length
                      : acceptedNodes.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tabs">
                  Tags
                  <Badge className="ml-2 text-white">{projectTags.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="proposed"
              className="flex-1 flex flex-col min-h-0 p-0 data-[state=inactive]:hidden"
            >
              <ScrollArea className="flex-1 h-0 px-3 py-3">
                {filteredProposed.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No proposed nodes
                    {selectedTags.length ? " matching filter" : ""}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredProposed.map((n) => (
                      <NodeCard
                        key={n.id}
                        node={n}
                        variant="proposed"
                        onSave={onSaveOne}
                        onReject={onRejectOne}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t bg-white px-3 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {selectedTags.length
                    ? filteredProposed.length
                      ? `${filteredProposed.length} proposed node${filteredProposed.length > 1 ? "s" : ""} (filtered)`
                      : "No proposed nodes match filters"
                    : proposedNodes.length
                      ? `${proposedNodes.length} proposed node${proposedNodes.length > 1 ? "s" : ""}`
                      : "No proposed nodes"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleRejectAll}
                    variant="destructive"
                    disabled={!filteredProposed?.length || rejectingAll}
                  >
                    {rejectingAll ? "Rejecting…" : "Reject All"}
                  </Button>
                  <Button
                    onClick={handleSaveAll}
                    disabled={!filteredProposed?.length || savingAll}
                    className="text-white"
                  >
                    {savingAll ? "Accepting…" : "Accept All"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="accepted"
              className="flex-1 flex flex-col min-h-0 p-0 data-[state=inactive]:hidden"
            >
              <ScrollArea className="flex-1 h-0 px-3 py-3">
                {filteredAccepted.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No accepted nodes
                    {selectedTags.length ? " matching filter" : ""}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredAccepted.map((n) => (
                      <NodeCard key={n.id} node={n} variant="accepted" />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            <TabsContent
              value="tabs"
              className="flex-1 flex flex-col min-h-0 p-0 data-[state=inactive]:hidden"
            >
              <ScrollArea className="flex-1 h-0 px-3 py-3">
                {!projectTags.length ? (
                  <p className="text-sm text-gray-500">No tags.</p>
                ) : (
                  <div className="space-y-2">
                    {projectTags
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((t) => {
                        const currentHex = toHex(t.r as number | undefined, t.g as number | undefined, t.b as number | undefined);
                        const draftRgb = hslToRgb(hslDraft.h, hslDraft.s, hslDraft.l);
                        const liveHex = openPickerTag === String(t._id) ? toHex(draftRgb.r, draftRgb.g, draftRgb.b) : currentHex;
                        return (
                          <div
                            key={String(t._id)}
                            className="flex items-center gap-3 p-2 border rounded-md bg-white"
                          >
                            <Popover
                              open={openPickerTag === String(t._id)}
                              onOpenChange={(o) => {
                                if (o) {
                                  const r = (t.r as number | undefined) ?? 79;
                                  const g = (t.g as number | undefined) ?? 70;
                                  const b = (t.b as number | undefined) ?? 229;
                                  setHslDraft(rgbToHsl(r, g, b));
                                  setOpenPickerTag(String(t._id));
                                } else {
                                  setOpenPickerTag(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded border"
                                  style={{ backgroundColor: liveHex }}
                                />
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-3 bg-white shadow-lg border" onPointerUp={async () => {
                                const { r, g, b } = hslToRgb(hslDraft.h, hslDraft.s, hslDraft.l);
                                await setColor({ tagId: t._id, r, g, b });
                                setOpenPickerTag(null);
                              }}>
                                <HslColorPicker
                                  color={hslDraft}
                                  onChange={(c: { h: number; s: number; l: number }) => setHslDraft(c)}
                                />
                              </PopoverContent>
                            </Popover>
                            <div className="text-sm text-gray-800 truncate max-w-[220px]">
                              {t.name.length > 25 ? t.name.slice(0, 25) + "…" : t.name}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
