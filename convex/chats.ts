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
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
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
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
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
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", chat.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Chat not found");

    return chat;
  },
});

export const listChatUsers = query({
  args: {
    chatId: v.id("chats"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      email: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const chat = await ctx.db.get(args.chatId);
    if (!chat) return [];

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", chat.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) return [];

    const links = await ctx.db
      .query("chatUsers")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    const slice =
      typeof args.limit === "number" ? links.slice(0, args.limit) : links;

    const results: { userId: any; name?: string; email: string }[] = [];
    for (const link of slice) {
      const u = await ctx.db.get(link.userId);
      results.push({
        userId: link.userId,
        name: (u as any)?.name ?? undefined,
        email: (u as any)?.email ?? "",
      });
    }
    return results;
  },
});

export const join = mutation({
  args: { chatId: v.id("chats") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    // must be a member of the project
    const member = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", chat.projectId)
      )
      .unique()
      .catch(() => null);
    if (!member) throw new Error("Not in project");

    // already in chat?
    const existing = await ctx.db
      .query("chatUsers")
      .withIndex("by_user_and_chat", (q) =>
        q.eq("userId", userId).eq("chatId", args.chatId)
      )
      .unique()
      .catch(() => null);

    if (!existing) {
      await ctx.db.insert("chatUsers", { chatId: args.chatId, userId });
    }
    return null;
  },
});

export const leave = mutation({
  args: { chatId: v.id("chats") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const link = await ctx.db
      .query("chatUsers")
      .withIndex("by_user_and_chat", (q) =>
        q.eq("userId", userId).eq("chatId", args.chatId)
      )
      .unique()
      .catch(() => null);

    if (link) {
      await ctx.db.delete(link._id);
    }
    return null;
  },
});

export const leaveAll = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const links = await ctx.db
      .query("chatUsers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const l of links) await ctx.db.delete(l._id);
    return links.length;
  },
});

export const leaveAllInProject = mutation({
  args: { projectId: v.id("projects") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const links = await ctx.db
      .query("chatUsers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const l of links) {
      const chat = await ctx.db.get(l.chatId);
      if (chat && chat.projectId === args.projectId) {
        await ctx.db.delete(l._id);
        count++;
      }
    }
    return count;
  },
});
