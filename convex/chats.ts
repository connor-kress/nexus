import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify membership in project
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
      .unique()
      .catch(() => null);
    if (!membership) {
      throw new Error("Project not found");
    }

    return await ctx.db.insert("chats", {
      name: args.name,
      projectId: args.projectId,
    });
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Verify membership
    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", args.projectId))
      .unique()
      .catch(() => null);
    if (!membership) return [];

    return await ctx.db
      .query("chats")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.id);
    if (!chat) throw new Error("Chat not found");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) => q.eq("userId", userId).eq("projectId", chat.projectId))
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Chat not found");

    return chat;
  },
});
