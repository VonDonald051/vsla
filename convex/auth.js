import bcrypt from "bcryptjs";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const roles = ["v_super_admin", "super_admin", "group_admin", "member"];
const clean = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const publicUser = (user) => ({
  id: user.externalId, firstName: user.firstName, lastName: user.lastName,
  email: user.email, role: user.role, groupId: user.groupExternalId,
  profilePic: user.profilePic,
});

export const state = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const groups = await ctx.db.query("groups").collect();
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "global")).unique();
    return {
      hasVSuperAdmin: users.some(user => user.role === "v_super_admin"),
      superAdminCount: users.filter(user => user.role === "super_admin").length,
      settings: settings || { safeCodeEnabled: false, globalLockout: false },
      userCount: users.length, groupCount: groups.length,
    };
  },
});

export const register = mutation({
  args: { firstName: v.string(), lastName: v.string(), email: v.string(), phone: v.optional(v.string()), password: v.string(), safeCode: v.optional(v.string()), roleSelection: v.optional(v.string()), groupId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (await ctx.db.query("users").withIndex("by_email", q => q.eq("email", email)).unique()) throw new Error("Email already registered.");
    const users = await ctx.db.query("users").collect();
    let role = roles.includes(args.roleSelection) ? args.roleSelection : "member";
    if (!users.some(user => user.role === "v_super_admin")) role = "v_super_admin";
    if (role === "super_admin" && users.filter(user => user.role === "super_admin").length >= 2) throw new Error("Maximum limit of 2 Super Admin accounts already reached.");
    if (role === "member" && settings?.safeCodeEnabled) {
      const code = await ctx.db.query("safeCodes").withIndex("by_code", q => q.eq("code", args.safeCode || "")).unique();
      if (!code || !code.active || code.used) throw new Error("Invalid or expired Safe Code required for member registration.");
      await ctx.db.patch(code._id, { used: true });
    }
    const stamp = Date.now().toString();
    const externalId = `u_${stamp}`;
    const groupId = role === "group_admin" ? `g_${stamp}` : (clean(args.groupId) || "g_default");
    await ctx.db.insert("users", { externalId, firstName: args.firstName.trim(), lastName: args.lastName.trim(), email, phone: clean(args.phone), passwordHash: await bcrypt.hash(args.password, 10), role, groupExternalId: groupId, failedLogins: 0, locked: false, createdAt: new Date().toISOString() });
    if (role === "group_admin") await ctx.db.insert("groups", { externalId: groupId, name: `${args.firstName.trim()}'s Group`, groupAdminExternalId: externalId, maxMembers: 40, description: `Group managed by ${args.firstName.trim()}` });
    if (role === "member") await ctx.db.insert("savings", { externalId: `s_${stamp}`, userExternalId: externalId, groupExternalId: groupId, amount: 200, type: "registration", week: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() });
    await ctx.db.insert("logs", { externalId: `l_${stamp}`, email, action: `REGISTER_${role.toUpperCase()}`, status: "SUCCESS", timestamp: new Date().toISOString() });
    return { success: true, user: { id: externalId, email, role, firstName: args.firstName, lastName: args.lastName } };
  },
});

export const login = mutation({
  args: { email: v.string(), password: v.string(), safeCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", args.email.trim().toLowerCase())).unique();
    if (!user) throw new Error("Invalid email or password.");
    if (!await bcrypt.compare(args.password, user.passwordHash)) {
      const failedLogins = user.failedLogins + 1;
      await ctx.db.patch(user._id, { failedLogins, locked: failedLogins >= 4 });
      if (failedLogins >= 4) { const settings = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "global")).unique(); if (settings) await ctx.db.patch(settings._id, { safeCodeEnabled: true }); }
      throw new Error(`Invalid password. Failed attempts: ${failedLogins}/4`);
    }
    if (user.locked) throw new Error("Account is locked due to failed password attempts. Enter a valid Safe Code to unlock.");
    await ctx.db.patch(user._id, { failedLogins: 0 });
    await ctx.db.insert("logs", { externalId: `l_${Date.now()}`, email: user.email, action: "LOGIN", status: "SUCCESS", timestamp: new Date().toISOString() });
    return { success: true, user: publicUser(user) };
  },
});
