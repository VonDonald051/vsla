import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// VSLA's persistent data model. Dates are ISO-8601 strings so records can be
// migrated directly from the current JSON backend without losing information.
export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    passwordHash: v.string(),
    role: v.union(
      v.literal("v_super_admin"),
      v.literal("super_admin"),
      v.literal("group_admin"),
      v.literal("member"),
    ),
    groupExternalId: v.optional(v.string()),
    profilePic: v.optional(v.string()),
    failedLogins: v.number(),
    locked: v.boolean(),
    createdAt: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_email", ["email"])
    .index("by_group_and_role", ["groupExternalId", "role"]),

  groups: defineTable({
    externalId: v.string(),
    name: v.string(),
    groupAdminExternalId: v.optional(v.string()),
    maxMembers: v.number(),
    description: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_group_admin", ["groupAdminExternalId"]),

  savings: defineTable({
    externalId: v.string(),
    userExternalId: v.string(),
    groupExternalId: v.string(),
    amount: v.number(),
    type: v.union(v.literal("registration"), v.literal("weekly")),
    week: v.string(),
    createdAt: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_user", ["userExternalId"])
    .index("by_group_and_week", ["groupExternalId", "week"]),

  loans: defineTable({
    externalId: v.string(),
    userExternalId: v.string(),
    requestedByExternalId: v.optional(v.string()),
    requestedByRole: v.optional(v.string()),
    groupExternalId: v.string(),
    type: v.union(v.literal("cash"), v.literal("item")),
    amount: v.optional(v.number()),
    profit: v.optional(v.number()),
    totalOwed: v.optional(v.number()),
    itemExternalId: v.optional(v.string()),
    itemName: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    dailyPenaltyRate: v.optional(v.number()),
    status: v.string(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_user", ["userExternalId"])
    .index("by_group_and_status", ["groupExternalId", "status"])
    .index("by_status", ["status"]),

  fines: defineTable({
    externalId: v.string(),
    groupExternalId: v.string(),
    userExternalId: v.string(),
    amount: v.number(),
    reason: v.string(),
    status: v.union(v.literal("unpaid"), v.literal("paid")),
    createdAt: v.string(),
    paidAt: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_user", ["userExternalId"])
    .index("by_group_and_status", ["groupExternalId", "status"]),

  items: defineTable({
    externalId: v.string(),
    groupExternalId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    status: v.union(v.literal("available"), v.literal("borrowed")),
    borrowedByExternalId: v.optional(v.string()),
    createdAt: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_group_and_status", ["groupExternalId", "status"]),

  safeCodes: defineTable({
    externalId: v.string(),
    code: v.string(),
    groupExternalId: v.string(),
    active: v.boolean(),
    used: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_code", ["code"])
    .index("by_group", ["groupExternalId"]),

  chats: defineTable({
    externalId: v.string(),
    groupExternalId: v.string(),
    senderExternalId: v.string(),
    senderName: v.string(),
    message: v.string(),
    encryptedMessage: v.optional(v.string()),
    timestamp: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_group_and_timestamp", ["groupExternalId", "timestamp"]),

  notes: defineTable({
    externalId: v.string(),
    vSuperAdminExternalId: v.string(),
    targetGroupExternalId: v.string(),
    message: v.string(),
    timestamp: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_target_group", ["targetGroupExternalId"]),

  logs: defineTable({
    externalId: v.string(),
    email: v.string(),
    action: v.string(),
    status: v.string(),
    ip: v.optional(v.string()),
    timestamp: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_email_and_timestamp", ["email", "timestamp"]),

  // Keep exactly one document with key "global" for application settings.
  settings: defineTable({
    key: v.literal("global"),
    safeCodeEnabled: v.boolean(),
    globalLockout: v.boolean(),
  }).index("by_key", ["key"]),
});
