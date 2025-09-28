"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Role = "owner" | "member";

export function MemberCollapse({
  projectId,
  myRole,
  onInviteClick,
  defaultOpen = true,
}: {
  projectId: Id<"projects">;
  myRole: Role | null;
  onInviteClick?: () => void;
  defaultOpen?: boolean;
}) {
  const members =
    useQuery(api.projects.listProjectMembers, { projectId }) ?? [];

  const [open, setOpen] = React.useState(defaultOpen);
  const count = members.length;

  return (
    <section className="mb-4 rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">Members</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {count}
          </span>
        </div>
        <svg
          className={cn(
            "h-4 w-4 text-gray-500 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="px-2 pb-2">
          {members.length ? (
            <ul className="max-h-52 overflow-y-auto space-y-1.5">
              {members.map((m) => (
                <li
                  key={m._id}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                      {initials(m.name || m.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {m.name || m.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {m.name ? m.email : ""}
                      </div>
                    </div>
                  </div>

                  <RoleBadge role={m.role} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-xs text-gray-500">No members yet</div>
          )}

          {myRole === "owner" && onInviteClick && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:text-white"
                onClick={onInviteClick}
              >
                Invite member
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const c =
    role === "owner"
      ? "bg-purple-50 text-purple-700 border-purple-200"
      : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span className={cn("text-[11px] px-2 py-0.5 rounded-md border", c)}>
      {role}
    </span>
  );
}

function initials(s: string) {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s[0]?.toUpperCase() || "?";
}
