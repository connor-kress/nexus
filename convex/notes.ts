import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const noteValidator = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  body: v.string(),
  status: v.optional(
    v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
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
        v.literal("rejected"),
      ),
    ),
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
      status: args.status ?? "pending",
    });

    if (args.tagNames && args.tagNames.length > 0) {
      for (const name of args.tagNames) {
        // Find or create tag in project catalog
        const tag = await ctx.db
          .query("tags")
          .withIndex("by_project_and_name", (q) => q.eq("projectId", args.projectId).eq("name", name))
          .unique()
          .catch(() => null);
        const tagId = tag?._id ?? (await ctx.db.insert("tags", { projectId: args.projectId, name }));
        // Add relation if missing
        const rel = await ctx.db
          .query("notesTags")
          .withIndex("by_note_and_tag", (q) => q.eq("noteId", noteId).eq("tagId", tagId))
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    const tag = await ctx.db
      .query("tags")
      .withIndex("by_project_and_name", (q) => q.eq("projectId", note.projectId).eq("name", args.name))
      .unique()
      .catch(() => null);
    const tagId = tag?._id ?? (await ctx.db.insert("tags", { projectId: note.projectId, name: args.name }));

    const rel = await ctx.db
      .query("notesTags")
      .withIndex("by_note_and_tag", (q) => q.eq("noteId", args.noteId).eq("tagId", tagId))
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
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
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", note.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    await ctx.db.patch(args.id, { body: args.body });
    return null;
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
      v.object({ id: v.string(), source: v.string(), target: v.string() })
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

    // Build tag mapping by traversing relations
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

    // Tag nodes (unique per name within a project)
    for (const name of tagNamesInProject) {
      nodes.push({ id: `tag:${name}`, kind: "tag", title: name });
    }

    // Note nodes and edges to tag nodes
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


