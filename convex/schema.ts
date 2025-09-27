import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  projects: defineTable({
    name: v.string(),
    userId: v.id("users"),
    description: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  chats: defineTable({
    name: v.string(),
    projectId: v.id("projects"),
    userId: v.id("users"),
  }).index("by_project", ["projectId"]).index("by_user", ["userId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    userId: v.id("users"),
  }).index("by_chat", ["chatId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
