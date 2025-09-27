import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
    });
    // Automatically add creator as owner member
    await ctx.db.insert("projectUsers", { projectId, userId, role: "owner" });
    return projectId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Find projects the user is a member of
    const memberships = await ctx.db
      .query("projectUsers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = [] as Array<any>;
    for (const m of memberships) {
      const p = await ctx.db.get(m.projectId);
      if (p) projects.push(p);
    }
    // Newest first by creation time
    projects.sort((a, b) => b._creationTime - a._creationTime);
    return projects;
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.id))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Project not found");

    return project;
  },
});
