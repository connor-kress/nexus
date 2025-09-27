import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
  noteId: v.id("notes"),
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

    // Require membership in project
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
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
        const existing = await ctx.db
          .query("tags")
          .withIndex("by_note_and_name", (q) => q.eq("noteId", noteId).eq("name", name))
          .unique()
          .catch(() => null);
        if (!existing) {
          await ctx.db.insert("tags", { noteId, projectId: args.projectId, name });
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("tags")
      .withIndex("by_note_and_name", (q) => q.eq("noteId", args.noteId).eq("name", args.name))
      .unique()
      .catch(() => null);
    if (!existing) {
      await ctx.db.insert("tags", { noteId: args.noteId, projectId: note.projectId, name: args.name });
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const tag = await ctx.db
      .query("tags")
      .withIndex("by_note_and_name", (q) => q.eq("noteId", args.noteId).eq("name", args.name))
      .unique()
      .catch(() => null);
    if (tag) {
      await ctx.db.delete(tag._id);
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
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
      const tags = await ctx.db
        .query("tags")
        .withIndex("by_note", (q) => q.eq("noteId", note._id))
        .collect();
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const tags = await ctx.db
      .query("tags")
      .withIndex("by_note", (q) => q.eq("noteId", note._id))
      .collect();

    return { note, tags };
  },
});


