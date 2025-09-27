import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const add = mutation({
  args: { noteId: v.id("notes"), name: v.string() },
  returns: v.id("tags"),
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
    if (existing) return existing._id;

    return await ctx.db.insert("tags", { noteId: args.noteId, projectId: note.projectId, name: args.name });
  },
});

export const list = query({
  args: { noteId: v.id("notes") },
  returns: v.array(
    v.object({
      _id: v.id("tags"),
      _creationTime: v.number(),
      noteId: v.id("notes"),
      name: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const note = await ctx.db.get(args.noteId);
    if (!note) return [];

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) return [];

    return await ctx.db
      .query("tags")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .order("asc")
      .collect();
  },
});

export const remove = mutation({
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
    if (tag) await ctx.db.delete(tag._id);
    return null;
  },
});


