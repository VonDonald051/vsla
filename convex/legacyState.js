import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Durable compatibility store for the existing Express API. Keeping one
// atomic snapshot prevents Vercel's ephemeral filesystem from losing records.
export const read = query({
  args: {},
  handler: async (ctx) => ctx.db.query("legacyState").withIndex("by_key", q => q.eq("key", "primary")).unique(),
});

export const write = mutation({
  args: { snapshot: v.any() },
  handler: async (ctx, args) => {
    const current = await ctx.db.query("legacyState").withIndex("by_key", q => q.eq("key", "primary")).unique();
    if (current) await ctx.db.patch(current._id, { snapshot: args.snapshot, updatedAt: new Date().toISOString() });
    else await ctx.db.insert("legacyState", { key: "primary", snapshot: args.snapshot, updatedAt: new Date().toISOString() });
  },
});
