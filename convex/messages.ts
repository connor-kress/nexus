import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

type SummaryResponse = {
  new: Array<{
    title: string;
    body: string;
    tags: string[];
  }>;
  updated: Array<{
    match: string;
    title: string;
    body: string;
    tags: string[];
  }>;
  deleted: Array<{
    match: string;
  }>;
};

type NoteWithTags = { note: Doc<"notes">; tags: Array<Doc<"tags">> };

const DEFAULT_MODEL = "x-ai/grok-4-fast:free";
// const DEFAULT_MODEL = "openai/gpt-5-nano";

function getSummaryPrompt(allMessages: Array<Doc<"messages">>, notes: Array<NoteWithTags>, latestMessage: string) {
  return [
    {
      role: "system",
      content: `
  You maintain a knowledge base of project notes. Your job is to propose incremental updates based on new user messages.

  Always output ONLY JSON in this exact shape:

  {
    "new": [
      {
        "title": string (<= 80 chars, UNIQUE across all notes),
        "body": string (short paragraph OR 3–6 compact bullets with key facts, decisions, next steps),
        "tags": string[] (1–5 lowercase keywords)
      }
    ],
    "updated": [
      {
        "match": string (MUST EXACTLY match the title of an existing note),
        "title": string (<= 80 chars, UNIQUE, may be updated but must not duplicate another title),
        "body": string,
        "tags": string[]
      }
    ],
    "deleted": [
      { "match": string (MUST EXACTLY match the title of an existing note to remove) }
    ]
  }

  Rules:
  - Always include "new", "updated", and "deleted".
  - Never produce duplicate titles in "new" or "updated".
  - "match" must be the exact title of an existing note.
  - If nothing meaningful changed, return {"new":[],"updated":[],"deleted":[]}.
  - Do not output free text, explanations, or markdown fences — ONLY valid compact JSON.

  Examples:

  Example 1:
  Latest user message: "Hello!"
  Expected output:
  {"new":[],"updated":[],"deleted":[]}

  Example 2:
  Latest user message: "The deadline has moved to Q3, not Q2."
  Given notes:
  [
    {
      "note": { "title": "Project deadline", "body": "Currently set to Q2" },
      "tags": [ { "name": "timeline" }, { "name": "deadline" } ]
    }
  ]
  Expected output:
  {
    "new": [],
    "updated": [
      {
        "match": "Project deadline",
        "title": "Project deadline",
        "body": "Deadline updated to Q3.",
        "tags": ["timeline","deadline"]
      }
    ],
    "deleted": []
  }

  Reminder: ONLY RESPOND WITH VALID JSON.
      `
    },
    {
      role: "user",
      content: `
  Here are the current project notes in JSON:
  ${JSON.stringify(notes, null, 2)}`
    },
    {
      role: "user",
      content: `Now propose updates based on the latest user message: """${latestMessage}"""`
    }
  ];
}

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

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const msg = await ctx.db.get(args.messageId);
    if (!msg) return null;
    if (msg.role !== "user") throw new Error("Cannot delete assistant message");
    if (msg.userId !== userId) throw new Error("Forbidden");

    const chat = await ctx.db.get(msg.chatId);
    if (!chat) return null;

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", chat.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) throw new Error("Forbidden");

    await ctx.db.delete(args.messageId);
    return null;
  },
});

export const sendMessage = action({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const userMessageId = await ctx.runMutation(api.messages.add, {
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

    let assistantMessage: string | null = null;

    // First block: generate and write the assistant reply; rollback on failure
    try {
      // simulate a failure
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
      const content: string | undefined = data.choices[0]?.message?.content;
      if (!content) throw new Error("No assistant message returned");

      assistantMessage = content;

      await ctx.runMutation(api.messages.add, {
        chatId: args.chatId,
        content: assistantMessage,
        role: "assistant",
      });
    } catch (error) {
      // Rollback the just-inserted user message on first reply failure
      try {
        await ctx.runMutation(api.messages.remove, { messageId: userMessageId });
      } catch (rollbackError) {
        console.error("Failed to rollback user message:", rollbackError);
      }
      console.error("Error getting or writing assistant reply:", error);
      throw new Error("Failed to get AI response");
    }

    // Second block: best-effort summary & note creation; do not rollback on failure
    try {
      const chat = await ctx.runQuery(api.chats.get, { id: args.chatId });
      const allMessages: Array<Doc<"messages">> = await ctx.runQuery(api.messages.list, { chatId: args.chatId });
      const notes: Array<NoteWithTags> =
        await ctx.runQuery(api.notes.listWithTagsByStatus, {
          projectId: chat.projectId,
          status: "accepted",
        });
      const summaryPrompt = getSummaryPrompt(allMessages, notes, args.content);
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
      if (!sumRes.ok) {
        throw new Error(`OpenRouter summary error: ${sumRes.statusText}`);
      }
      const sumData: any = await sumRes.json();
      const raw = sumData.choices?.[0]?.message?.content ?? "";
      let debug = false;
      if (debug) console.log("DATA =", raw);
      let parsed: SummaryResponse;
      try {
        parsed = JSON.parse(raw);
        if (debug) console.log("PARSED =", parsed);
      } catch (error) {
        if (debug) console.log("PARSING ERROR =", error);
        return assistantMessage;
      }
      // const tagNames = Array.isArray(parsed.tags)
      //   ? parsed.tags
      //       .map((t) => String(t).toLowerCase().trim())
      //       .filter((t) => t.length > 0)
      //       .slice(0, 5)
      //   : [];
      for (const note of parsed.new) {
        await ctx.runMutation(api.notes.create, {
          projectId: chat.projectId,
          title: note.title,
          body: note.body,
          tagNames: note.tags,
          status: "pending",
        });
      }
      for (const upd of parsed.updated) {
        await ctx.runMutation(api.notes.updateByProjectAndMatchTitle, {
          projectId: chat.projectId,
          match: upd.match,
          title: upd.title,
          body: upd.body,
          tagNames: upd.tags,
        });
      }
      for (const del of parsed.deleted) {
        await ctx.runMutation(api.notes.removeByProjectAndTitle, {
          projectId: chat.projectId,
          title: del.match,
        });
      }
    } catch (summaryError) {
      console.error("Summary generation failed:", summaryError);
    }

    return assistantMessage;
  },
});
