import { TableNames } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export const resetDatabase = mutation(async (ctx) => {
  const tables = ["invitations", "tags", "notes", "messages", "chats", "projectUsers", "projects"]; // all tables
  for (const table of tables) {
    const docs = await ctx.db.query(table as TableNames).collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
  }
});