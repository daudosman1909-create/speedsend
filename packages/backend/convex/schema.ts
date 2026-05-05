import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
    ...authTables,

    browserSessions: defineTable({
        userId: v.optional(v.id("users")),
        sessionToken: v.string(),
        deviceName: v.string(),
        browserName: v.string(),
        status: v.union(
            v.literal("waiting"),
            v.literal("connected"),
            v.literal("disconnected"),
            v.literal("expired")
        ),
        connectedAt: v.optional(v.number()),
        expiresAt: v.number(),
        endedAt: v.optional(v.number()),
        phoneDeviceName: v.optional(v.string()),
    })
        .index("by_token", ["sessionToken"])
        .index("by_user", ["userId"]),

    pairingCodes: defineTable({
        sessionId: v.id("browserSessions"),
        code: v.string(),
        qrToken: v.string(),
        expiresAt: v.number(),
        usedAt: v.optional(v.number()),
        status: v.union(
            v.literal("active"),
            v.literal("used"),
            v.literal("expired")
        ),
    })
        .index("by_code", ["code"])
        .index("by_qr", ["qrToken"])
        .index("by_session", ["sessionId"]),

    sharedItems: defineTable({
        sessionId: v.id("browserSessions"),
        userId: v.optional(v.id("users")),
        senderDevice: v.union(v.literal("web"), v.literal("phone")),
        itemType: v.union(
            v.literal("text"),
            v.literal("link"),
            v.literal("image"),
            v.literal("video"),
            v.literal("audio"),
            v.literal("pdf"),
            v.literal("document"),
            v.literal("file")
        ),
        textContent: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        mimeType: v.optional(v.string()),
        storageMode: v.union(v.literal("temporary"), v.literal("saved")),
        expiresAt: v.optional(v.number()),
        deletedAt: v.optional(v.number()),
        isSaved: v.boolean(),
        transferStatus: v.union(
            v.literal("uploading"),
            v.literal("ready"),
            v.literal("failed"),
            v.literal("deleted")
        ),
        // Position on canvas for web grid
        canvasX: v.optional(v.number()),
        canvasY: v.optional(v.number()),
    })
        .index("by_session", ["sessionId"])
        .index("by_user_saved", ["userId", "isSaved"]),

    subscriptions: defineTable({
        userId: v.id("users"),
        plan: v.union(v.literal("free"), v.literal("pro")),
        priceCents: v.number(),
        currency: v.string(),
        billingInterval: v.union(v.literal("monthly"), v.literal("yearly")),
        status: v.union(
            v.literal("active"),
            v.literal("canceled"),
            v.literal("past_due")
        ),
        startedAt: v.number(),
        renewsAt: v.optional(v.number()),
        canceledAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),
});
