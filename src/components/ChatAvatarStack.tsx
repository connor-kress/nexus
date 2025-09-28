"use client";

import * as React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function ChatAvatarStack({
  chatId,
  max = 4,
  size = 20,
  overlap = 10,
}: {
  chatId: Id<"chats">;
  max?: number;
  size?: number;
  overlap?: number;
}) {
  const users = useQuery(api.chats.listChatUsers, { chatId, limit: max }) ?? [];

  if (!users.length) return null;

  return (
    <div
      className="flex items-center justify-end"
      style={{ minWidth: size + (users.length - 1) * (size - overlap) }}
      aria-label={`${users.length} participants`}
    >
      <div className="flex -space-x-2">
        {users.slice(0, max).map((u) => {
          const label = u.name || u.email;
          const initials = getInitials(label);
          const bg = colorFromString(label);

          return (
            <div
              key={String(u.userId)}
              className="flex items-center justify-center rounded-full border border-white text-[10px] font-semibold text-white"
              style={{
                width: size,
                height: size,
                backgroundColor: bg,
              }}
              title={label}
            >
              {initials}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getInitials(s: string) {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (s[0] || "?").toUpperCase();
}

function colorFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const h = Math.abs(hash) % 360;
  const s = 55;
  const l = 55;
  return `hsl(${h} ${s}% ${l}%)`;
}
