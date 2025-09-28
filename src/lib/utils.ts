import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const timeAgo = (time: any) => () => {
  const now = Date.now();
  const created = new Date(time).getTime();
  const diffSec = Math.floor((now - created) / 1000);
  if (diffSec < 10) return "now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(time).toLocaleDateString();
};
