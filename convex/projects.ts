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

export const membershipRole = query({
  args: { id: v.id("projects") },
  returns: v.union(v.literal("owner"), v.literal("member"), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.id)
      )
      .unique()
      .catch(() => null);
    return membership?.role ?? null;
  },
});

export const inviteByEmail = mutation({
  args: { projectId: v.id("projects"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to invite members.");
    }

    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("Please enter an email address.");

    // Verify inviter is owner of the project
    const inviterMembership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!inviterMembership || inviterMembership.role !== "owner") {
      throw new Error("Only project owners can invite members.");
    }

    // Resolve email to existing auth user
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique()
      .catch(() => null);

    if (!existingUser) {
      throw new Error("No user found with that email.");
    }

    // If already a member, block inviting
    const existingMembership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", existingUser._id).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (existingMembership) {
      throw new Error("That user is already a member of this project.");
    }

    // Create or refresh pending invitation referencing userId
    const existingInvite = await ctx.db
      .query("invitations")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", existingUser._id)
      )
      .unique()
      .catch(() => null);

    if (existingInvite && existingInvite.status !== "revoked") {
      if (existingInvite.status === "pending") {
        throw new Error("This user already has a pending invitation.");
      }
      if (existingInvite.status === "accepted") {
        throw new Error("This user has already accepted an invitation.");
      }
    }

    await ctx.db.insert("invitations", {
      projectId: args.projectId,
      userId: existingUser._id,
      invitedBy: userId,
      status: "pending",
    });
    return null;
  },
});

export const listInvitations = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("invitations"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      userEmail: v.string(),
      invitedBy: v.id("users"),
      status: v.optional(
        v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"))
      ),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const inviterMembership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", args.projectId)
      )
      .unique()
      .catch(() => null);
    if (!inviterMembership || inviterMembership.role !== "owner") return [];

    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_project_and_user", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    const result = [] as Array<{
      _id: any; _creationTime: number; projectId: any; userId: any; userEmail: string; invitedBy: any; status?: "pending" | "accepted" | "revoked";
    }>;
    for (const inv of invites) {
      const u = await ctx.db.get(inv.userId);
      const userEmail = (u as any)?.email ?? "";
      result.push({ ...inv, userEmail });
    }
    return result;
  },
});

export const acceptMyInvites = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const pendingInvites = await ctx.db
      .query("invitations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let accepted = 0;
    for (const invite of pendingInvites) {
      if (invite.status === "accepted") continue;
      // Ensure membership exists
      const existing = await ctx.db
        .query("projectUsers")
        .withIndex("by_user_and_project", (q) =>
          q.eq("userId", userId).eq("projectId", invite.projectId)
        )
        .unique()
        .catch(() => null);
      if (!existing) {
        await ctx.db.insert("projectUsers", {
          projectId: invite.projectId,
          userId,
          role: "member",
        });
      }
      await ctx.db.patch(invite._id, { status: "accepted" });
      accepted++;
    }
    return accepted;
  },
});

export const myInvitations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("invitations"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      projectName: v.string(),
      invitedBy: v.id("users"),
      status: v.optional(
        v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"))
      ),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const invites = await ctx.db
      .query("invitations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const results: Array<{
      _id: any;
      _creationTime: number;
      projectId: any;
      projectName: string;
      invitedBy: any;
      status?: "pending" | "accepted" | "revoked";
    }> = [];
    for (const inv of invites) {
      if (inv.status === "revoked") continue;
      const project = await ctx.db.get(inv.projectId);
      if (!project) continue;
      results.push({
        _id: inv._id,
        _creationTime: inv._creationTime,
        projectId: inv.projectId,
        projectName: project.name,
        invitedBy: inv.invitedBy,
        status: inv.status,
      });
    }
    // Newest first
    results.sort((a, b) => b._creationTime - a._creationTime);
    return results;
  },
});

export const acceptInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in.");
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");
    if (inv.userId !== userId) throw new Error("Not your invitation.");

    const membership = await ctx.db
      .query("projectUsers")
      .withIndex("by_user_and_project", (q) =>
        q.eq("userId", userId).eq("projectId", inv.projectId)
      )
      .unique()
      .catch(() => null);
    if (!membership) {
      await ctx.db.insert("projectUsers", {
        projectId: inv.projectId,
        userId,
        role: "member",
      });
    }
    await ctx.db.patch(inv._id, { status: "accepted" });
    return null;
  },
});

export const rejectInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in.");
    const inv = await ctx.db.get(args.invitationId);
    if (!inv) throw new Error("Invitation not found.");
    if (inv.userId !== userId) throw new Error("Not your invitation.");
    await ctx.db.patch(inv._id, { status: "revoked" });
    return null;
  },
});
