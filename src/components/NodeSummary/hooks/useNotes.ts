import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export function useNotes(projectId: Id<"projects">) {
  const all = useQuery(api.notes.listByProject, { projectId });
  // With status removed, treat all notes as "accepted" and none as "pending".
  return {
    notes: all ?? [],
    loading: all === undefined,
  };
}

export function useNoteUpdates(projectId: Id<"projects">) {
  const updates = useQuery(api.notes.listUpdates, { projectId });
  return {
    updates: updates ?? [],
    loading: updates === undefined,
  };
}
