import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export function useNotesByStatus(projectId: Id<"projects">) {
  const pending = useQuery(api.notes.listByProjectAndStatus, {
    projectId,
    status: "pending",
  });
  const accepted = useQuery(api.notes.listByProjectAndStatus, {
    projectId,
    status: "accepted",
  });
  return {
    pending: pending ?? [],
    accepted: accepted ?? [],
    loading: pending === undefined || accepted === undefined,
  };
}
