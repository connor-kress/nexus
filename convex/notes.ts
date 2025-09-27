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
  status: v.optional(
    v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"))
  ),
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
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected")
      )
    ),
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
      status: args.status ?? "pending",
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

export const listByProjectAndStatus = query({
  args: {
    projectId: v.id("projects"),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  },
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
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return notes.filter((n) => (n.status ?? "pending") === args.status);
  },
});

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

export const listWithTagsByStatus = query({
  args: {
    projectId: v.id("projects"),
    status: v.union(v.literal("pending"), v.literal("accepted")),
  },
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
    const filtered = notes.filter(
      (n) => (n.status ?? "pending") === args.status
    );
    const results: Array<{ note: any; tags: any[] }> = [];
    for (const note of filtered) {
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

export const setStatus = mutation({
  args: {
    noteId: v.id("notes"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected")
    ),
  },
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
    await ctx.db.patch(args.noteId, { status: args.status });
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
    for (const id of args.approveIds) {
      await ctx.runMutation(api.notes.setStatus, {
        noteId: id,
        status: "accepted",
      });
    }
    for (const id of args.rejectIds) {
      await ctx.runMutation(api.notes.setStatus, {
        noteId: id,
        status: "rejected",
      });
    }
    return {
      approved: args.approveIds.length,
      rejected: args.rejectIds.length,
    };
  },
});
