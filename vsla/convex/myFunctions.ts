import { mutation, query, MutationCtx, QueryCtx } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { v } from 'convex/values';

const MAX_GROUP_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_MESSAGE_LENGTH = 2_000;

function generateId() { return crypto.randomUUID(); }

async function requireCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Authentication is required.');
  const user = await ctx.db.query('users').withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier)).unique();
  if (!user) throw new Error('Your account is not initialized. Please sign in again.');
  return user;
}

async function requireGroupAdmin(ctx: QueryCtx | MutationCtx, groupId: string) {
  const user = await requireCurrentUser(ctx);
  const group = await ctx.db.query('groups').withIndex('by_groupAdminId', (q) => q.eq('groupAdminId', user.id)).filter((q) => q.eq(q.field('id'), groupId)).unique();
  if (!group) throw new Error('You are not authorized to access this group.');
  return { group, user };
}

function text(value: string, label: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} must be between 1 and ${max} characters.`);
  return result;
}
function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) throw new Error(`${label} must be a valid positive amount.`);
  return value;
}

export const upsertCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Authentication is required.');
    const now = new Date().toISOString();
    const existing = await ctx.db.query('users').withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { email: identity.email ?? existing.email, firstName: identity.givenName ?? existing.firstName, lastName: identity.familyName ?? existing.lastName, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('users', { id: generateId(), tokenIdentifier: identity.tokenIdentifier, email: identity.email, firstName: identity.givenName, lastName: identity.familyName, role: 'member', failedLogins: 0, locked: false, createdAt: now, updatedAt: now });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Authentication is required.');
    return await ctx.db.query('users').withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier)).unique();
  },
});
export const getUserGroups = query({ args: {}, handler: async (ctx) => { const user = await requireCurrentUser(ctx); return await ctx.db.query('groups').withIndex('by_groupAdminId', (q) => q.eq('groupAdminId', user.id)).collect(); } });
export const createGroup = mutation({
  args: { name: v.string(), maxMembers: v.optional(v.number()), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const maxMembers = args.maxMembers ?? 50;
    if (!Number.isInteger(maxMembers) || maxMembers < 1 || maxMembers > 10_000) throw new Error('Maximum members must be an integer between 1 and 10,000.');
    const description = args.description?.trim();
    if (description && description.length > MAX_DESCRIPTION_LENGTH) throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
    const id = generateId(); const now = new Date().toISOString();
    await ctx.db.insert('groups', { id, name: text(args.name, 'Group name', MAX_GROUP_NAME_LENGTH), groupAdminId: user.id, maxMembers, description, createdAt: now, updatedAt: now });
    return id;
  },
});
export const getGroupById = query({ args: { groupId: v.string() }, handler: async (ctx, args) => (await requireGroupAdmin(ctx, args.groupId)).group });

export const createLoan = mutation({
  args: { userId: v.string(), groupId: v.string(), type: v.string(), amount: v.number(), profit: v.number(), dueDate: v.string(), dailyPenaltyRate: v.optional(v.number()), itemName: v.optional(v.string()), requestedByRole: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireGroupAdmin(ctx, args.groupId); const amount = positive(args.amount, 'Loan amount'); const profit = positive(args.profit, 'Loan profit'); const penalty = args.dailyPenaltyRate ?? 0.01;
    if (Number.isNaN(Date.parse(args.dueDate)) || !Number.isFinite(penalty) || penalty < 0 || penalty > 1) throw new Error('Loan details are invalid.');
    const id = generateId(); await ctx.db.insert('loans', { id, userId: args.userId, requestedBy: user.id, groupId: args.groupId, type: text(args.type, 'Loan type', 50), amount, profit, totalOwed: amount + profit, dueDate: args.dueDate, dailyPenaltyRate: penalty, status: 'pending', itemName: args.itemName?.trim(), requestedByRole: args.requestedByRole?.trim(), createdAt: new Date().toISOString() }); return id;
  },
});
export const getGroupLoans = query({ args: { groupId: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); return await ctx.db.query('loans').withIndex('by_groupId', (q) => q.eq('groupId', args.groupId)).collect(); } });
export const updateLoanStatus = mutation({ args: { loanId: v.string(), status: v.union(v.literal('approved'), v.literal('rejected'), v.literal('paid'), v.literal('pending')) }, handler: async (ctx, args) => { const loan = await ctx.db.query('loans').filter((q) => q.eq(q.field('id'), args.loanId)).unique(); if (!loan?.groupId) throw new Error('Loan not found.'); const { user } = await requireGroupAdmin(ctx, loan.groupId); await ctx.db.patch(loan._id, { status: args.status, approvedBy: user.id, approvedAt: new Date().toISOString() }); } });

export const createSavings = mutation({ args: { userId: v.string(), groupId: v.string(), amount: v.number(), type: v.string(), week: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); const now = new Date().toISOString(); const id = generateId(); await ctx.db.insert('savings', { id, userId: args.userId, groupId: args.groupId, amount: positive(args.amount, 'Savings amount'), type: text(args.type, 'Savings type', 50), week: text(args.week, 'Week', 50), createdAt: now, updatedAt: now }); return id; } });
export const getGroupSavings = query({ args: { groupId: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); return await ctx.db.query('savings').withIndex('by_groupId', (q) => q.eq('groupId', args.groupId)).collect(); } });
export const createFine = mutation({ args: { userId: v.string(), groupId: v.string(), amount: v.number(), reason: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); const id = generateId(); await ctx.db.insert('fines', { id, userId: args.userId, groupId: args.groupId, amount: positive(args.amount, 'Fine amount'), reason: text(args.reason, 'Fine reason', 500), status: 'unpaid', createdAt: new Date().toISOString() }); return id; } });
export const getGroupFines = query({ args: { groupId: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); return await ctx.db.query('fines').withIndex('by_groupId', (q) => q.eq('groupId', args.groupId)).collect(); } });
export const sendMessage = mutation({ args: { groupId: v.string(), message: v.string() }, handler: async (ctx, args) => { const { user } = await requireGroupAdmin(ctx, args.groupId); const id = generateId(); await ctx.db.insert('chats', { id, groupId: args.groupId, senderId: user.id, senderName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member', message: text(args.message, 'Message', MAX_MESSAGE_LENGTH), createdAt: new Date().toISOString() }); return id; } });
export const getGroupMessages = query({ args: { groupId: v.string() }, handler: async (ctx, args) => { await requireGroupAdmin(ctx, args.groupId); return await ctx.db.query('chats').withIndex('by_groupId', (q) => q.eq('groupId', args.groupId)).order('asc').collect(); } });
