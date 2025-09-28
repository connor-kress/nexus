import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

const noteValidator = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  body: v.string(),
});

const tagValidator = v.object({
  _id: v.id("tags"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  name: v.string(),
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    body: v.string(),
    tagNames: v.optional(v.array(v.string())),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Project not found");
    const noteId = await ctx.db.insert("notes", {
      projectId: args.projectId,
      title: args.title,
      body: args.body,
    });
    if (args.tagNames && args.tagNames.length > 0) {
      for (const name of args.tagNames) {
        const tag = await ctx.db
          .query("tags")
          .withIndex("by_project_and_name", (q) =>
            q.eq("projectId", args.projectId).eq("name", name)
          )
          .unique()
          .catch(() => null);
        const tagId =
          tag?._id ??
          (await ctx.db.insert("tags", { projectId: args.projectId, name }));
        const rel = await ctx.db
          .query("notesTags")
          .withIndex("by_note_and_tag", (q) =>
            q.eq("noteId", noteId).eq("tagId", tagId)
          )
          .unique()
          .catch(() => null);
        if (!rel) {
          await ctx.db.insert("notesTags", { noteId, tagId });
        }
      }
    }
    return noteId;
  },
});

export const addTag = mutation({
  args: { noteId: v.id("notes"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", note.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", note.projectId).eq("name", args.name)
      )
      .unique()
      .catch(() => null);
    const tagId =
      tag?._id ??
      (await ctx.db.insert("tags", {
        projectId: note.projectId,
        name: args.name,
      }));
    const rel = await ctx.db
      .query("notesTags")
      .withIndex("by_note_and_tag", (q) =>
        q.eq("noteId", args.noteId).eq("tagId", tagId)
      )
      .unique()
      .catch(() => null);
    if (!rel) {
      await ctx.db.insert("notesTags", { noteId: args.noteId, tagId });
    }
    return null;
  },
});

export const removeTag = mutation({
  args: { noteId: v.id("notes"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.noteId);
    if (!note) throw new Error("Note not found");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", note.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", note.projectId).eq("name", args.name)
      )
      .unique()
      .catch(() => null);
    if (tag) {
      const rel = await ctx.db
        .query("notesTags")
        .withIndex("by_note_and_tag", (q) =>
          q.eq("noteId", args.noteId).eq("tagId", tag._id)
        )
        .unique()
        .catch(() => null);
      if (rel) {
        await ctx.db.delete(rel._id);
      }
    }
    return null;
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(noteValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) return [];
    return await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Removed status-based list; use listByProject and filter client-side if needed

export const listWithTags = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      note: noteValidator,
      tags: v.array(tagValidator),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) return [];
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    const results: Array<{ note: any; tags: any[] }> = [];
    for (const note of notes) {
      const relations = await ctx.db
        .query("notesTags")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();
      const tags: any[] = [];
      for (const rel of relations) {
        const tag = await ctx.db.get(rel.tagId);
        if (tag) tags.push(tag);
      }
      results.push({ note, tags });
    }
    return results;
  },
});

export const listUpdates = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("noteUpdates"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      type: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
      match: v.string(),
      title: v.string(),
      body: v.string(),
      tagId: v.optional(v.id("tags")),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) return [];

    return await ctx.db
      .query("noteUpdates")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
  },
});

// Removed status-based listWithTags; use listWithTags and filter client-side if needed

export const getWithTags = query({
  args: { id: v.id("notes") },
  returns: v.object({
    note: noteValidator,
    tags: v.array(tagValidator),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", note.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");
    const relations = await ctx.db
      .query("notesTags")
      .withIndex("by_note", (q) => q.eq("noteId", note._id))
      .collect();
    const tags: any[] = [];
    for (const rel of relations) {
      const tag = await ctx.db.get(rel.tagId);
      if (tag) tags.push(tag);
    }
    return { note, tags };
  },
});

export const updateBody = mutation({
  args: { id: v.id("notes"), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Note not found");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", note.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");
    await ctx.db.patch(args.id, { body: args.body });
    return null;
  },
});

export const enqueueUpdate = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
    match: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    tagNames: v.optional(v.array(v.string())),
  },
  returns: v.id("noteUpdates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    // Create update first
    const updateId = await ctx.db.insert("noteUpdates", {
      projectId: args.projectId,
      userId,
      type: args.type,
      match: args.match ?? "",
      title: args.title ?? "",
      body: args.body ?? "",
    });

    // Upsert tags and attach to the proposal via notesTags.noteUpdateId
    if (args.tagNames && args.tagNames.length > 0) {
      const names = Array.from(
        new Set(args.tagNames.map((n) => n.trim()).filter((n) => n.length > 0))
      );
      for (const name of names) {
        const existing = await ctx.db
          .query("tags")
          .withIndex("by_project_and_name", (q) =>
            q.eq("projectId", args.projectId).eq("name", name)
          )
          .unique()
          .catch(() => null);
        const tagId = existing?._id ?? (await ctx.db.insert("tags", { projectId: args.projectId, name }));
        const rel = await ctx.db
          .query("notesTags")
          .withIndex("by_update_and_tag", (q) => q.eq("noteUpdateId", updateId).eq("tagId", tagId as any))
          .unique()
          .catch(() => null);
        if (!rel) await ctx.db.insert("notesTags", { noteId: undefined as any, tagId: tagId as any, noteUpdateId: updateId as any });
      }
    }

    return updateId as any;
  },
});

export const upsertTag = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", args.projectId).eq("name", args.name)
      )
      .unique()
      .catch(() => null);
    if (existing) return existing._id;
    return await ctx.db.insert("tags", { projectId: args.projectId, name: args.name });
  },
});

export const applyUpdate = mutation({
  args: { updateId: v.id("noteUpdates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const update = await ctx.db.get(args.updateId);
    if (!update) return null;

    // Ensure user can apply only their own updates and is a project member
    if (update.userId !== userId) throw new Error("Forbidden");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", update.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const projectId = update.projectId;

    if (update.type === "create") {
      const noteId = await ctx.db.insert("notes", {
        projectId,
        title: update.title ?? "",
        body: update.body ?? "",
      });
      // Move any proposal tag relations onto the new note
      const proposalTags = await ctx.db
        .query("notesTags")
        .withIndex("by_update", (q) => q.eq("noteUpdateId", update._id as any))
        .collect();
      for (const rel of proposalTags) {
        if (!rel.tagId) continue;
        const exists = await ctx.db
          .query("notesTags")
          .withIndex("by_note_and_tag", (q) => q.eq("noteId", noteId).eq("tagId", rel.tagId))
          .unique()
          .catch(() => null);
        if (!exists) await ctx.db.insert("notesTags", { noteId, tagId: rel.tagId });
        await ctx.db.delete(rel._id);
      }
    } else if (update.type === "update") {
      const existing = await ctx.db
        .query("notes")
        .withIndex("by_project_and_title", (q) =>
          q.eq("projectId", projectId).eq("title", update.match ?? "")
        )
        .unique()
        .catch(() => null);
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: update.title ?? existing.title,
          body: update.body ?? existing.body,
        });
        // Move any proposal tag relations onto the existing note
        const proposalTags = await ctx.db
          .query("notesTags")
          .withIndex("by_update", (q) => q.eq("noteUpdateId", update._id as any))
          .collect();
        for (const rel of proposalTags) {
          if (!rel.tagId) continue;
          const exists = await ctx.db
            .query("notesTags")
            .withIndex("by_note_and_tag", (q) => q.eq("noteId", existing._id).eq("tagId", rel.tagId))
            .unique()
            .catch(() => null);
          if (!exists)
            await ctx.db.insert("notesTags", { noteId: existing._id, tagId: rel.tagId });
          await ctx.db.delete(rel._id);
        }
      }
    } else if (update.type === "delete") {
      const existing = await ctx.db
        .query("notes")
        .withIndex("by_project_and_title", (q) =>
          q.eq("projectId", projectId).eq("title", update.match ?? "")
        )
        .unique()
        .catch(() => null);
      if (existing) {
        const rels = await ctx.db
          .query("notesTags")
          .withIndex("by_note", (q) => q.eq("noteId", existing._id))
          .collect();
        for (const rel of rels) {
          await ctx.db.delete(rel._id);
        }
        await ctx.db.delete(existing._id);
      }
    }

    // Remove the processed update
    await ctx.db.delete(args.updateId);
    return null;
  },
});

export const rejectUpdate = mutation({
  args: { updateId: v.id("noteUpdates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const update = await ctx.db.get(args.updateId);
    if (!update) return null;

    // Ensure user can reject only their own updates and is a project member
    if (update.userId !== userId) throw new Error("Forbidden");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", update.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    // Remove any tag relations tied to this proposal
    const proposalTags = await ctx.db
      .query("notesTags")
      .withIndex("by_update", (q) => q.eq("noteUpdateId", update._id as any))
      .collect();
    for (const rel of proposalTags) {
      await ctx.db.delete(rel._id);
    }

    // Remove the update itself
    await ctx.db.delete(args.updateId);
    return null;
  },
});

// Removed setStatus; status is no longer tracked on notes

export const removeByProjectAndTitle = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const note = await ctx.db
      .query("notes")
      .withIndex("by_project_and_title", (q) =>
        q.eq("projectId", args.projectId).eq("title", args.title)
      )
      .unique()
      .catch(() => null);
    if (!note) return null;

    const rels = await ctx.db
      .query("notesTags")
      .withIndex("by_note", (q) => q.eq("noteId", note._id))
      .collect();
    for (const rel of rels) {
      await ctx.db.delete(rel._id);
    }

    await ctx.db.delete(note._id);
    return null;
  },
});

export const updateByProjectAndMatchTitle = mutation({
  args: {
    projectId: v.id("projects"),
    match: v.string(),
    title: v.string(),
    body: v.string(),
    tagNames: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const note = await ctx.db
      .query("notes")
      .withIndex("by_project_and_title", (q) =>
        q.eq("projectId", args.projectId).eq("title", args.match)
      )
      .unique()
      .catch(() => null);
    if (!note) return null;

    // Update basic fields
    await ctx.db.patch(note._id, { title: args.title, body: args.body });

    // Sync tags: make relations match tagNames exactly
    const desiredNames = Array.from(
      new Set(args.tagNames.map((n) => n.trim()).filter((n) => n.length > 0))
    );

    // Resolve desired tag ids (create any missing)
    const desiredTagIds: string[] = [] as any;
    for (const name of desiredNames) {
      const existingTag = await ctx.db
        .query("tags")
        .withIndex("by_project_and_name", (q) =>
          q.eq("projectId", args.projectId).eq("name", name)
        )
        .unique()
        .catch(() => null);
      const tagId = existingTag?._id ?? (await ctx.db.insert("tags", { projectId: args.projectId, name }));
      desiredTagIds.push(tagId as any);
    }

    // Current relations
    const currentRels = await ctx.db
      .query("notesTags")
      .withIndex("by_note", (q) => q.eq("noteId", note._id))
      .collect();
    const currentTagIdSet = new Set(currentRels.map((r) => String(r.tagId)));
    const desiredTagIdSet = new Set(desiredTagIds.map((id) => String(id)));

    // Remove relations not desired
    for (const rel of currentRels) {
      if (!desiredTagIdSet.has(String(rel.tagId))) {
        await ctx.db.delete(rel._id);
      }
    }

    // Add missing relations
    for (const tagId of desiredTagIds) {
      if (!currentTagIdSet.has(String(tagId))) {
        const existingRel = await ctx.db
          .query("notesTags")
          .withIndex("by_note_and_tag", (q) =>
            q.eq("noteId", note._id).eq("tagId", tagId as any)
          )
          .unique()
          .catch(() => null);
        if (!existingRel) {
          await ctx.db.insert("notesTags", { noteId: note._id, tagId: tagId as any });
        }
      }
    }

    return null;
  },
});

export const isMember = query({
  args: { projectId: v.id("projects") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    return !!membership;
  },
});

export const review = action({
  args: {
    projectId: v.id("projects"),
    approveIds: v.array(v.id("notes")),
    rejectIds: v.array(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const ok = await ctx.runQuery(api.notes.isMember, {
      projectId: args.projectId,
    });
    if (!ok) throw new Error("Forbidden");
    // Status no longer tracked; intentionally a no-op for now
    return {
      approved: args.approveIds.length,
      rejected: args.rejectIds.length,
    };
  },
});

export const graphForProject = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    nodes: v.array(
      v.object({
        id: v.string(),
        kind: v.union(v.literal("note"), v.literal("tag")),
        title: v.string(),
        body: v.optional(v.string()),
        noteId: v.optional(v.id("notes")),
      })
    ),
    edges: v.array(
      v.object({
        id: v.string(),
        source: v.string(),
        target: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { nodes: [], edges: [] };
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) return { nodes: [], edges: [] };
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    const noteIdToTagNames: Record<string, Set<string>> = {};
    const tagNamesInProject: Set<string> = new Set();
    for (const note of notes) {
      const rels = await ctx.db
        .query("notesTags")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();
      for (const rel of rels) {
        const tag = await ctx.db.get(rel.tagId);
        if (!tag) continue;
        const key = String(note._id);
        if (!noteIdToTagNames[key]) noteIdToTagNames[key] = new Set();
        noteIdToTagNames[key].add(tag.name);
        tagNamesInProject.add(tag.name);
      }
    }
    const nodes: Array<{
      id: string;
      kind: "note" | "tag";
      title: string;
      body?: string;
      noteId?: any;
    }> = [];
    const edges: Array<{ id: string; source: string; target: string }> = [];
    for (const name of tagNamesInProject) {
      nodes.push({ id: `tag:${name}`, kind: "tag", title: name });
    }
    for (const note of notes) {
      const noteNodeId = `note:${String(note._id)}`;
      nodes.push({
        id: noteNodeId,
        kind: "note",
        title: note.title,
        body: note.body,
        noteId: note._id,
      });
      const tagNames = noteIdToTagNames[String(note._id)] ?? new Set<string>();
      for (const name of tagNames) {
        const tagNodeId = `tag:${name}`;
        const edgeId = `e:${noteNodeId}|${tagNodeId}`;
        edges.push({ id: edgeId, source: noteNodeId, target: tagNodeId });
      }
    }
    return { nodes, edges };
  },
});
