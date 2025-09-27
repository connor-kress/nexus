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

    // Find or create the tag in the project's tag catalog
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) => q.eq("projectId", note.projectId).eq("name", args.name))
      .unique()
      .catch(() => null);

    const tagId = tag?._id ?? (await ctx.db.insert("tags", { projectId: note.projectId, name: args.name }));

    // Ensure relation exists between note and tag
    const existingRel = await ctx.db
      .query("notesTags")
      .withIndex("by_note_and_tag", (q) => q.eq("noteId", args.noteId).eq("tagId", tagId))
      .unique()
      .catch(() => null);
    if (!existingRel) {
      await ctx.db.insert("notesTags", { noteId: args.noteId, tagId });
    }

    return tagId;
  },
});

export const list = query({
  args: { noteId: v.id("notes") },
  returns: v.array(
    v.object({
      _id: v.id("tags"),
      _creationTime: v.number(),
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

    const relations = await ctx.db
      .query("notesTags")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const results: Array<{ _id: any; _creationTime: number; name: string }> = [];
    for (const rel of relations) {
      const tag = await ctx.db.get(rel.tagId);
      if (tag) results.push(tag);
    }
    // Sort alphabetically by name for stability
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
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
      .withIndex("by_project_and_name", (q) => q.eq("projectId", note.projectId).eq("name", args.name))
      .unique()
      .catch(() => null);
    if (tag) {
      const rel = await ctx.db
        .query("notesTags")
        .withIndex("by_note_and_tag", (q) => q.eq("noteId", args.noteId).eq("tagId", tag._id))
        .unique()
        .catch(() => null);
      if (rel) await ctx.db.delete(rel._id);
    }
    return null;
  },
});


