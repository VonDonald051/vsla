import { mutation } from "./_generated/server";
import { v } from "convex/values";

const nonEmptyString = (value) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * Imports the legacy data/db.json snapshot exactly once. This mutation refuses
 * to run if the deployment already has VSLA data, preventing accidental
 * duplicate imports.
 */
export const importLegacySnapshot = mutation({
  args: { snapshot: v.any() },
  handler: async (ctx, { snapshot }) => {
    const existingUser = await ctx.db.query("users").first();
    const existingGroup = await ctx.db.query("groups").first();
    if (existingUser || existingGroup) {
      throw new Error(
        "Import stopped: this Convex deployment already contains VSLA data.",
      );
    }

    const rows = (name) => (Array.isArray(snapshot[name]) ? snapshot[name] : []);
    const insertAll = async (table, documents) => {
      for (const document of documents) await ctx.db.insert(table, document);
    };

    await insertAll(
      "users",
      rows("users").map((user) => ({
        externalId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: nonEmptyString(user.phone),
        passwordHash: user.passwordHash,
        role: user.role,
        groupExternalId: nonEmptyString(user.groupId),
        profilePic: nonEmptyString(user.profilePic),
        failedLogins: Number(user.failedLogins || 0),
        locked: Boolean(user.locked),
        createdAt: nonEmptyString(user.createdAt),
      })),
    );
    await insertAll(
      "groups",
      rows("groups").map((group) => ({
        externalId: group.id,
        name: group.name,
        groupAdminExternalId: nonEmptyString(group.groupAdminId),
        maxMembers: Number(group.maxMembers || 40),
        description: nonEmptyString(group.description),
        createdAt: nonEmptyString(group.createdAt),
      })),
    );
    await insertAll(
      "savings",
      rows("savings").map((saving) => ({
        externalId: saving.id,
        userExternalId: saving.userId,
        groupExternalId: saving.groupId,
        amount: Number(saving.amount),
        type: saving.type,
        week: saving.week,
        createdAt: saving.createdAt,
      })),
    );
    await insertAll(
      "loans",
      rows("loans").map((loan) => ({
        externalId: loan.id,
        userExternalId: loan.userId,
        requestedByExternalId: nonEmptyString(loan.requestedBy),
        requestedByRole: nonEmptyString(loan.requestedByRole),
        groupExternalId: loan.groupId,
        type: loan.type,
        amount: typeof loan.amount === "number" ? loan.amount : undefined,
        profit: typeof loan.profit === "number" ? loan.profit : undefined,
        totalOwed: typeof loan.totalOwed === "number" ? loan.totalOwed : undefined,
        itemExternalId: nonEmptyString(loan.itemId),
        itemName: nonEmptyString(loan.itemName),
        dueDate: nonEmptyString(loan.dueDate),
        dailyPenaltyRate:
          typeof loan.dailyPenaltyRate === "number"
            ? loan.dailyPenaltyRate
            : undefined,
        status: loan.status,
        approvedBy: nonEmptyString(loan.approvedBy),
        approvedAt: nonEmptyString(loan.approvedAt),
        createdAt: loan.createdAt,
      })),
    );
    await insertAll(
      "fines",
      rows("fines").map((fine) => ({
        externalId: fine.id,
        groupExternalId: fine.groupId,
        userExternalId: fine.userId,
        amount: Number(fine.amount),
        reason: fine.reason || "Fine",
        status: fine.status,
        createdAt: fine.createdAt,
        paidAt: nonEmptyString(fine.paidAt),
      })),
    );
    await insertAll(
      "items",
      rows("items").map((item) => ({
        externalId: item.id,
        groupExternalId: item.groupId,
        name: item.name,
        description: nonEmptyString(item.description),
        price: Number(item.price),
        status: item.status,
        borrowedByExternalId: nonEmptyString(item.borrowedBy),
        createdAt: nonEmptyString(item.createdAt),
      })),
    );
    await insertAll(
      "safeCodes",
      rows("safeCodes").map((safeCode) => ({
        externalId: safeCode.id,
        code: safeCode.code,
        groupExternalId: safeCode.groupId,
        active: Boolean(safeCode.active),
        used: Boolean(safeCode.used),
        createdAt: safeCode.createdAt,
      })),
    );
    await insertAll(
      "chats",
      rows("chats").map((chat) => ({
        externalId: chat.id,
        groupExternalId: chat.groupId,
        senderExternalId: chat.senderId,
        senderName: chat.senderName,
        message: chat.message,
        encryptedMessage: nonEmptyString(chat.encryptedMessage),
        timestamp: chat.timestamp,
      })),
    );
    await insertAll(
      "notes",
      rows("notes").map((note) => ({
        externalId: note.id,
        vSuperAdminExternalId: note.vSuperAdminId,
        targetGroupExternalId: note.targetGroupId,
        message: note.message,
        timestamp: note.timestamp,
      })),
    );
    await insertAll(
      "logs",
      rows("logs").map((log) => ({
        externalId: log.id,
        email: log.email,
        action: log.action,
        status: log.status,
        ip: nonEmptyString(log.ip),
        timestamp: log.timestamp,
      })),
    );

    const settings = snapshot.settings || {};
    await ctx.db.insert("settings", {
      key: "global",
      safeCodeEnabled: Boolean(settings.safeCodeEnabled),
      globalLockout: Boolean(settings.globalLockout),
    });
    await ctx.db.insert("legacyState", {
      key: "primary",
      snapshot,
      updatedAt: new Date().toISOString(),
    });

    return Object.fromEntries(
      [
        "users", "groups", "savings", "loans", "fines", "items", "safeCodes",
        "chats", "notes", "logs",
      ].map((name) => [name, rows(name).length]),
    );
  },
});
