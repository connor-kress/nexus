// app/components/NodeSummary.tsx
"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { NodeCard, type NodeItem } from "./NodeCard";
import { cn } from "@/lib/utils";

type Props = {
  proposedNodes: NodeItem[];
  acceptedNodes: NodeItem[];
  onSaveOne?: (id: string) => Promise<void> | void;
  onRejectOne?: (id: string) => Promise<void> | void;
  onSaveMany?: (ids: string[]) => Promise<void> | void;
  onTabChange?: (tab: "proposed" | "accepted") => void;
  className?: string;
};

export default function NodeSummaryPanel({
  proposedNodes,
  acceptedNodes,
  onSaveOne,
  onRejectOne,
  onSaveMany,
  onTabChange,
  className,
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

  return (
    <div className={cn("h-full w-full p-3 flex flex-col min-h-0", className)}>
      <div className="text-sm font-medium text-gray-600 mb-2">Node Summary</div>

      <div className="flex-1 min-h-0 rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
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
                <p className="text-sm text-gray-500">No proposed nodes yet.</p>
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
                <p className="text-sm text-gray-500">No accepted nodes yet.</p>
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
      </div>
    </div>
  );
}
