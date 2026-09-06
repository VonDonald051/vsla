import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    id: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nationalId: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    role: v.optional(v.string()),
    groupId: v.optional(v.string()),
    profilePic: v.optional(v.string()),
    failedLogins: v.optional(v.number()),
    locked: v.optional(v.boolean()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  groups: defineTable({
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    groupAdminId: v.optional(v.string()),
    maxMembers: v.optional(v.number()),
    description: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  loans: defineTable({
    id: v.optional(v.string()),
    userId: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
    requestedByRole: v.optional(v.string()),
    groupId: v.optional(v.string()),
    type: v.optional(v.string()),
    amount: v.optional(v.number()),
    profit: v.optional(v.number()),
    totalOwed: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    dailyPenaltyRate: v.optional(v.number()),
    status: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    itemId: v.optional(v.string()),
    itemName: v.optional(v.string()),
  }),

  fines: defineTable({
    id: v.optional(v.string()),
    userId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    amount: v.optional(v.number()),
    reason: v.optional(v.string()),
    status: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
  }),

  savings: defineTable({
    id: v.optional(v.string()),
    userId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    amount: v.optional(v.number()),
    type: v.optional(v.string()),
    week: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  items: defineTable({
    id: v.optional(v.string()),
    groupId: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    status: v.optional(v.string()),
    borrowedBy: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  }),

  safeCodes: defineTable({
    id: v.optional(v.string()),
    code: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    usedAt: v.optional(v.string()),
    active: v.optional(v.boolean()),
  }),

  chats: defineTable({
    id: v.optional(v.string()),
    groupId: v.optional(v.string()),
    senderId: v.optional(v.string()),
    senderName: v.optional(v.string()),
    message: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  }),

  notes: defineTable({
    id: v.optional(v.string()),
    userId: v.optional(v.string()),
    groupId: v.optional(v.string()),
    text: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  }),

  logs: defineTable({
    id: v.optional(v.string()),
    email: v.optional(v.string()),
    action: v.optional(v.string()),
    status: v.optional(v.string()),
    ip: v.optional(v.string()),
    timestamp: v.optional(v.string()),
    details: v.optional(v.string()),
  }),

  settings: defineTable({
    key: v.optional(v.string()),
    value: v.optional(v.any()),
    updatedAt: v.optional(v.string()),
  }),
});
