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

type Props = {
  proposedNodes?: NodeItem[];
  acceptedNodes?: NodeItem[];
  onSaveOne?: (id: string) => Promise<void> | void;
  onRejectOne?: (id: string) => Promise<void> | void;
  onSaveMany?: (ids: string[]) => Promise<void> | void;
  onTabChange?: (tab: "proposed" | "accepted") => void;
  className?: string;
  selectedNoteId?: Id<"notes"> | null;
  onClear?: () => void;
};

export default function NodeSummaryPanel({
  proposedNodes = [],
  acceptedNodes = [],
  onSaveOne,
  onRejectOne,
  onSaveMany,
  onTabChange,
  className,
  selectedNoteId,
  onClear,
}: Props) {
  const [tab, setTab] = React.useState<"proposed" | "accepted">("proposed");
  const [savingAll, setSavingAll] = React.useState(false);

  React.useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  const handleSaveAll = async () => {
    if (!proposedNodes?.length || !onSaveMany) return;
    try {
      setSavingAll(true);
      await onSaveMany(proposedNodes.map((n) => n.id));
    } finally {
      setSavingAll(false);
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
      <div className="text-sm font-medium text-gray-600 mb-2">Node Summary</div>

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
            onValueChange={(v) => setTab(v as "proposed" | "accepted")}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="border-b px-3 pt-3">
              <TabsList>
                <TabsTrigger value="proposed">
                  Proposed
                  <Badge className="ml-2">{proposedNodes?.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="accepted">
                  Accepted
                  <Badge className="ml-2">{acceptedNodes?.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="proposed"
              className="flex-1 flex flex-col min-h-0 p-0 data-[state=inactive]:hidden"
            >
              <ScrollArea className="flex-1 h-0 px-3 py-3">
                {proposedNodes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No proposed nodes yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {proposedNodes.map((n) => (
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
                  {proposedNodes?.length
                    ? `${proposedNodes?.length} proposed node${proposedNodes?.length > 1 ? "s" : ""}`
                    : "No proposed nodes"}
                </span>
                <Button
                  onClick={handleSaveAll}
                  disabled={!proposedNodes?.length || savingAll}
                >
                  {savingAll ? "Saving…" : "Save all proposed nodes"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent
              value="accepted"
              className="flex-1 flex flex-col min-h-0 p-0 data-[state=inactive]:hidden"
            >
              <ScrollArea className="flex-1 h-0 px-3 py-3">
                {acceptedNodes.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No accepted nodes yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {acceptedNodes.map((n) => (
                      <NodeCard key={n.id} node={n} variant="accepted" />
                    ))}
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
