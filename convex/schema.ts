import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }),

  chats: defineTable({
    name: v.string(),
    projectId: v.id("projects"),
  }).index("by_project", ["projectId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    userId: v.id("users"),
  }).index("by_chat", ["chatId"]),

  // Notes (project-scoped, user-owned)
  notes: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    body: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_title", ["projectId", "title"]),

  // Tags catalog per project (normalized)
  tags: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
  })
    .index("by_project_and_name", ["projectId", "name"])
    .index("by_project", ["projectId"])
    .index("by_name", ["name"]),

  // Note-Tag relation
  notesTags: defineTable({
    noteId: v.optional(v.id("notes")),
    tagId: v.id("tags"),
    // Allow associating tags to either a note OR a noteUpdate (proposal)
    noteUpdateId: v.optional(v.id("noteUpdates")),
  })
    .index("by_note", ["noteId"])
    .index("by_tag", ["tagId"])
    .index("by_note_and_tag", ["noteId", "tagId"])
    .index("by_update", ["noteUpdateId"]) 
    .index("by_update_and_tag", ["noteUpdateId", "tagId"]),

  // Note updates queue/log
  noteUpdates: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    type: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    // Strings default to empty on insert to avoid nullability
    match: v.string(),
    title: v.string(),
    body: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]) 
    .index("by_user_and_project", ["userId", "projectId"]) 
    .index("by_user_project_and_type", ["userId", "projectId", "type"]),

  // Memberships: many users per project
  projectUsers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_user_and_project", ["userId", "projectId"]),

  // Project invitations referencing users via foreign key
  invitations: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    invitedBy: v.id("users"),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"))
    ),
  })
    .index("by_project_and_user", ["projectId", "userId"])
    .index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
