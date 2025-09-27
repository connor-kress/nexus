"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NodeItem = {
  id: string;
  title: string;
  summary?: string;
  createdAt?: string | number | Date;
  tokens?: number;
};

type NodeCardProps = {
  node: NodeItem;
  variant: "proposed" | "accepted";
  onSave?: (id: string) => void | Promise<void>;
  onReject?: (id: string) => void | Promise<void>;
  className?: string;
};

export function NodeCard({
  node,
  variant,
  onSave,
  onReject,
  className,
}: NodeCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 bg-white",
        variant === "proposed" ? "border-amber-200" : "border-gray-200",
        className
      )}
    >
      {/* Header row: title + tags/date */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-gray-900 truncate">
          {node.title}
        </h4>
        <div className="flex items-center gap-2 shrink-0">
          {typeof node.tokens === "number" && (
            <Badge variant="outline" className="text-xs">
              {node.tokens} tok
            </Badge>
          )}
          {node.createdAt && (
            <span className="text-xs text-gray-500">
              {formatTime(node.createdAt)}
            </span>
          )}
        </div>
      </div>

      {node.summary ? (
        <p className="mt-1 text-sm text-gray-700">{node.summary}</p>
      ) : null}

      {variant === "proposed" && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (onSave) void onSave(node.id);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (onReject) void onReject(node.id);
            }}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTime(t: string | number | Date) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}
