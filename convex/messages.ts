import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const list = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Verify chat ownership
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

export const add = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify chat ownership
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== userId) {
      throw new Error("Chat not found");
    }

    return await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: args.content,
      role: args.role,
      userId,
    });
  },
});

export const sendMessage = action({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Add user message
    await ctx.runMutation(api.messages.add, {
      chatId: args.chatId,
      content: args.content,
      role: "user",
    });

    // Get chat history for context
    const messages: Array<{ role: "user" | "assistant"; content: string }> = await ctx.runQuery(api.messages.list, {
      chatId: args.chatId,
    });

    // Prepare messages for OpenRouter
    const openRouterMessages: Array<{ role: string; content: string }> = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      // Call OpenRouter API
      const response: Response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.2-3b-instruct:free", // Free model
          messages: openRouterMessages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const assistantMessage: string | undefined = data.choices[0]?.message?.content;

      if (assistantMessage) {
        // Add assistant response
        await ctx.runMutation(api.messages.add, {
          chatId: args.chatId,
          content: assistantMessage,
          role: "assistant",
        });
      }

      return assistantMessage || null;
    } catch (error) {
      console.error("Error calling OpenRouter:", error);
      throw new Error("Failed to get AI response");
    }
  },
});
