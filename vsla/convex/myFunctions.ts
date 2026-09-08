import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Generate a simple UUID-like string
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create a user from WorkOS authentication data
 * This ensures user data persists permanently in Convex database
 */
export const upsertUserFromWorkOS = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePicture: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists by WorkOS ID stored in custom field
    const existingUsers = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), args.email))
      .collect();

    if (existingUsers.length > 0) {
      // Update existing user with latest data
      const user = existingUsers[0];
      await ctx.db.patch(user._id, {
        firstName: args.firstName || user.firstName,
        lastName: args.lastName || user.lastName,
        profilePic: args.profilePicture || user.profilePic,
        updatedAt: new Date().toISOString(),
      });
      return user._id;
    } else {
      // Create new user
      const userId = generateId();
      const newUserId = await ctx.db.insert('users', {
        id: userId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePic: args.profilePicture,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'member',
        failedLogins: 0,
        locked: false,
      });
      return newUserId;
    }
  },
});

/**
 * Get current authenticated user from database
 */
export const getCurrentUser = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), args.email))
      .collect();

    if (users.length === 0) {
      return null;
    }

    return users[0];
  },
});

/**
 * Get user by ID
 */
export const getUserById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('id'), args.userId))
      .collect();

    return users.length > 0 ? users[0] : null;
  },
});

/**
 * Get all groups for a user
 */
export const getUserGroups = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('groups')
      .filter((q) => q.eq(q.field('groupAdminId'), args.userId))
      .collect();
  },
});

/**
 * Create a new group
 */
export const createGroup = mutation({
  args: {
    name: v.string(),
    groupAdminId: v.string(),
    maxMembers: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const groupId = generateId();
    await ctx.db.insert('groups', {
      id: groupId,
      name: args.name,
      groupAdminId: args.groupAdminId,
      maxMembers: args.maxMembers || 50,
      description: args.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return groupId;
  },
});

/**
 * Get group by ID
 */
export const getGroupById = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    const groups = await ctx.db
      .query('groups')
      .filter((q) => q.eq(q.field('id'), args.groupId))
      .collect();

    return groups.length > 0 ? groups[0] : null;
  },
});

/**
 * Create a new loan record
 */
export const createLoan = mutation({
  args: {
    userId: v.string(),
    groupId: v.string(),
    type: v.string(),
    amount: v.number(),
    profit: v.number(),
    dueDate: v.string(),
    dailyPenaltyRate: v.optional(v.number()),
    itemName: v.optional(v.string()),
    requestedByRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = generateId();
    const totalOwed = args.amount + args.profit;
    
    await ctx.db.insert('loans', {
      id: loanId,
      userId: args.userId,
      groupId: args.groupId,
      type: args.type,
      amount: args.amount,
      profit: args.profit,
      totalOwed: totalOwed,
      dueDate: args.dueDate,
      dailyPenaltyRate: args.dailyPenaltyRate || 0.01,
      status: 'pending',
      itemName: args.itemName,
      requestedByRole: args.requestedByRole,
      createdAt: new Date().toISOString(),
    });
    
    return loanId;
  },
});

/**
 * Get all loans for a group
 */
export const getGroupLoans = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('loans')
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .collect();
  },
});

/**
 * Update loan status
 */
export const updateLoanStatus = mutation({
  args: {
    loanId: v.string(),
    status: v.string(),
    approvedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loans = await ctx.db
      .query('loans')
      .filter((q) => q.eq(q.field('id'), args.loanId))
      .collect();

    if (loans.length === 0) {
      throw new Error('Loan not found');
    }

    await ctx.db.patch(loans[0]._id, {
      status: args.status,
      approvedBy: args.approvedBy,
      approvedAt: new Date().toISOString(),
    });
  },
});

/**
 * Create a savings record
 */
export const createSavings = mutation({
  args: {
    userId: v.string(),
    groupId: v.string(),
    amount: v.number(),
    type: v.string(),
    week: v.string(),
  },
  handler: async (ctx, args) => {
    const savingId = generateId();
    
    await ctx.db.insert('savings', {
      id: savingId,
      userId: args.userId,
      groupId: args.groupId,
      amount: args.amount,
      type: args.type,
      week: args.week,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    return savingId;
  },
});

/**
 * Get all savings for a group
 */
export const getGroupSavings = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('savings')
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .collect();
  },
});

/**
 * Create a fine record
 */
export const createFine = mutation({
  args: {
    userId: v.string(),
    groupId: v.string(),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const fineId = generateId();
    
    await ctx.db.insert('fines', {
      id: fineId,
      userId: args.userId,
      groupId: args.groupId,
      amount: args.amount,
      reason: args.reason,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    });
    
    return fineId;
  },
});

/**
 * Get all fines for a group
 */
export const getGroupFines = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('fines')
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .collect();
  },
});

/**
 * Send a chat message
 */
export const sendMessage = mutation({
  args: {
    groupId: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const chatId = generateId();
    
    await ctx.db.insert('chats', {
      id: chatId,
      groupId: args.groupId,
      senderId: args.senderId,
      senderName: args.senderName,
      message: args.message,
      createdAt: new Date().toISOString(),
    });
    
    return chatId;
  },
});

/**
 * Get all messages for a group
 */
export const getGroupMessages = query({
  args: {
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chats')
      .filter((q) => q.eq(q.field('groupId'), args.groupId))
      .order('asc')
      .collect();
  },
});
