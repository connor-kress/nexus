import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// const DEFAULT_MODEL = "x-ai/grok-4-fast:free";
const DEFAULT_MODEL = "openai/gpt-5-nano";

export const list = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

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

    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", chat.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    return await ctx.db.insert("messages", {
      chatId: args.chatId,
      content: args.content,
      role: args.role,
      userId: userId,
    });
  },
});

export const sendMessage = action({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    await ctx.runMutation(api.messages.add, {
      chatId: args.chatId,
      content: args.content,
      role: "user",
    });

    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      await ctx.runQuery(api.messages.list, {
        chatId: args.chatId,
      });

    const openRouterMessages: Array<{ role: string; content: string }> =
      messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    try {
      const response: Response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: openRouterMessages,
            temperature: 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      const assistantMessage: string | undefined =
        data.choices[0]?.message?.content;

      if (assistantMessage) {
        await ctx.runMutation(api.messages.add, {
          chatId: args.chatId,
          content: assistantMessage,
          role: "assistant",
        });

        const chat = await ctx.runQuery(api.chats.get, { id: args.chatId });
        const allMessages: Array<{
          role: "user" | "assistant";
          content: string;
        }> = await ctx.runQuery(api.messages.list, { chatId: args.chatId });
        const summaryPrompt = [
          {
            role: "system",
            content:
              'You produce compact JSON for a knowledge note. Respond only JSON with shape {"title":string,"body":string,"tags":string[]}. Title <= 80 chars. Body is a short paragraph or 3–6 bullets with key decisions, facts, next steps. Tags are 1–5 lowercase keywords.',
          },
          ...allMessages.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user",
            content: `Create a note highlighting the latest user message: """${args.content}"""`,
          },
        ];
        const sumRes: Response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL,
              messages: summaryPrompt,
              temperature: 0.2,
            }),
          }
        );
        if (sumRes.ok) {
          const sumData: any = await sumRes.json();
          const raw = sumData.choices?.[0]?.message?.content ?? "";
          let parsed: { title?: string; body?: string; tags?: string[] } = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { title: "Chat summary", body: raw, tags: [] };
          }
          const title = (parsed.title ?? "Chat summary").slice(0, 80);
          const body = (parsed.body ?? "").trim();
          const tagNames = Array.isArray(parsed.tags)
            ? parsed.tags
                .map((t) => String(t).toLowerCase().trim())
                .filter((t) => t.length > 0)
                .slice(0, 5)
            : [];
          await ctx.runMutation(api.notes.create, {
            projectId: chat.projectId,
            title,
            body,
            tagNames,
            status: "pending",
          });
        }
      }

      return assistantMessage || null;
    } catch (error) {
      console.error("Error calling OpenRouter:", error);
      throw new Error("Failed to get AI response");
    }
  },
});
