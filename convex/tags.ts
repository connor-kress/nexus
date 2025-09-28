import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

function hsvToRgb(h: number, s: number, vVal: number): { r: number; g: number; b: number } {
  const c = vVal * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vVal - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return { r, g, b };
}

export const ensureWithColor = internalMutation({
  args: { projectId: v.id("projects"), name: v.string() },
  returns: v.id("tags"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", args.projectId).eq("name", args.name)
      )
      .unique()
      .catch(() => null);
    if (existing) {
      if (existing.r == null || existing.g == null || existing.b == null) {
        // backfill missing color
        const count = await ctx.db
          .query("tags")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect();
        const hue = (count.length * 137.508) % 360; // golden angle
        const { r, g, b } = hsvToRgb(hue, 0.6, 0.95);
        await ctx.db.patch(existing._id, { r, g, b });
      }
      return existing._id;
    }
    const count = await ctx.db
      .query("tags")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const hue = (count.length * 137.508) % 360;
    const { r, g, b } = hsvToRgb(hue, 0.6, 0.95);
    const id = await ctx.db.insert("tags", { projectId: args.projectId, name: args.name, r, g, b });
    return id;
  },
});

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

    // Ensure the tag exists with a color
    const tagId: Id<"tags"> = await ctx.runMutation(internal.tags.ensureWithColor, {
      projectId: note.projectId,
      name: args.name,
    });

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

export const listByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("tags"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      name: v.string(),
      r: v.optional(v.number()),
      g: v.optional(v.number()),
      b: v.optional(v.number()),
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
      .query("tags")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const setColor = mutation({
  args: {
    tagId: v.id("tags"),
    r: v.number(),
    g: v.number(),
    b: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const tag = await ctx.db.get(args.tagId);
    if (!tag) throw new Error("Tag not found");
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", tag.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");
    await ctx.db.patch(args.tagId, { r: args.r, g: args.g, b: args.b });
    return null;
  },
});


