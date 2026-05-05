import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { incrementAnalyticsSummary } from "./analyticsHelpers";

const itemTypeValidator = v.union(
    v.literal("text"),
    v.literal("link"),
    v.literal("image"),
    v.literal("video"),
    v.literal("audio"),
    v.literal("pdf"),
    v.literal("document"),
    v.literal("file")
);

type ItemsCtx = QueryCtx | MutationCtx;

function isFileLikeItemType(itemType: "text" | "link" | "image" | "video" | "audio" | "pdf" | "document" | "file") {
    return itemType !== "text" && itemType !== "link";
}

async function getSessionByToken(ctx: ItemsCtx, sessionToken: string) {
    return await ctx.db
        .query("browserSessions")
        .withIndex("by_token", (q) => q.eq("sessionToken", sessionToken))
        .unique();
}

export const generateUploadUrl = mutation({
    args: {},
    returns: v.string(),
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

export const sendItem = mutation({
    args: {
        sessionToken: v.string(),
        senderDevice: v.union(v.literal("web"), v.literal("phone")),
        itemType: itemTypeValidator,
        textContent: v.optional(v.string()),
        storageId: v.optional(v.id("_storage")),
        fileName: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        mimeType: v.optional(v.string()),
        canvasX: v.optional(v.number()),
        canvasY: v.optional(v.number()),
    },
    returns: v.id("sharedItems"),
    handler: async (ctx, args) => {
        const session = await getSessionByToken(ctx, args.sessionToken);
        if (!session) throw new Error("Session not found");
        if (session.status === "expired" || session.status === "disconnected") {
            throw new Error("Session is no longer active");
        }
        const userId = await getAuthUserId(ctx);
        // Determine pro status
        let isPro = false;
        if (session.userId) {
            const sub = await ctx.db
                .query("subscriptions")
                .withIndex("by_user", (q) => q.eq("userId", session.userId!))
                .order("desc")
                .first();
            if (sub && sub.status === "active" && sub.plan === "pro") isPro = true;
        }
        const id = await ctx.db.insert("sharedItems", {
            sessionId: session._id,
            userId: session.userId ?? userId ?? undefined,
            senderDevice: args.senderDevice,
            itemType: args.itemType,
            textContent: args.textContent,
            storageId: args.storageId,
            fileName: args.fileName,
            fileSize: args.fileSize,
            mimeType: args.mimeType,
            storageMode: "temporary",
            isSaved: false,
            transferStatus: "ready",
            expiresAt: isPro ? undefined : session.expiresAt,
            canvasX: args.canvasX,
            canvasY: args.canvasY,
        });
        await incrementAnalyticsSummary(ctx, {
            totalItemsShared: 1,
            totalFilesShared: isFileLikeItemType(args.itemType) ? 1 : 0,
            totalLinksShared: args.itemType === "link" ? 1 : 0,
            totalTextShared: args.itemType === "text" ? 1 : 0,
            totalSharedBytes: args.fileSize ?? 0,
        });
        return id;
    },
});

export const listSessionItems = query({
    args: { sessionToken: v.string() },
    returns: v.array(
        v.object({
            _id: v.id("sharedItems"),
            _creationTime: v.number(),
            senderDevice: v.union(v.literal("web"), v.literal("phone")),
            itemType: itemTypeValidator,
            textContent: v.optional(v.string()),
            fileName: v.optional(v.string()),
            fileSize: v.optional(v.number()),
            mimeType: v.optional(v.string()),
            storageMode: v.union(v.literal("temporary"), v.literal("saved")),
            isSaved: v.boolean(),
            transferStatus: v.union(
                v.literal("uploading"),
                v.literal("ready"),
                v.literal("failed"),
                v.literal("deleted")
            ),
            fileUrl: v.union(v.string(), v.null()),
            canvasX: v.optional(v.number()),
            canvasY: v.optional(v.number()),
        })
    ),
    handler: async (ctx, args) => {
        const session = await getSessionByToken(ctx, args.sessionToken);
        if (!session) return [];
        const items = await ctx.db
            .query("sharedItems")
            .withIndex("by_session", (q) => q.eq("sessionId", session._id))
            .order("desc")
            .collect();
        const result = [];
        for (const it of items) {
            if (it.transferStatus === "deleted") continue;
            let url: string | null = null;
            if (it.storageId) {
                url = await ctx.storage.getUrl(it.storageId);
            }
            result.push({
                _id: it._id,
                _creationTime: it._creationTime,
                senderDevice: it.senderDevice,
                itemType: it.itemType,
                textContent: it.textContent,
                fileName: it.fileName,
                fileSize: it.fileSize,
                mimeType: it.mimeType,
                storageMode: it.storageMode,
                isSaved: it.isSaved,
                transferStatus: it.transferStatus,
                fileUrl: url,
                canvasX: it.canvasX,
                canvasY: it.canvasY,
            });
        }
        return result;
    },
});

export const deleteItem = mutation({
    args: { itemId: v.id("sharedItems"), sessionToken: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await getSessionByToken(ctx, args.sessionToken);
        if (!session) throw new Error("Session not found");
        const item = await ctx.db.get(args.itemId);
        if (!item) return null;
        if (item.sessionId !== session._id) throw new Error("Forbidden");
        if (item.storageId) {
            try {
                await ctx.storage.delete(item.storageId);
            } catch {
                // ignore
            }
        }
        await ctx.db.patch(item._id, {
            deletedAt: Date.now(),
            transferStatus: "deleted",
        });
        return null;
    },
});

export const saveItem = mutation({
    args: { itemId: v.id("sharedItems"), sessionToken: v.string() },
    returns: v.object({ saved: v.boolean(), needsUpgrade: v.boolean() }),
    handler: async (ctx, args) => {
        const session = await getSessionByToken(ctx, args.sessionToken);
        if (!session) throw new Error("Session not found");
        const item = await ctx.db.get(args.itemId);
        if (!item) throw new Error("Item not found");
        if (item.sessionId !== session._id) throw new Error("Forbidden");

        // Determine pro status
        let isPro = false;
        if (session.userId) {
            const sub = await ctx.db
                .query("subscriptions")
                .withIndex("by_user", (q) => q.eq("userId", session.userId!))
                .order("desc")
                .first();
            if (sub && sub.status === "active" && sub.plan === "pro") isPro = true;
        }
        if (!isPro) return { saved: false, needsUpgrade: true };

        if (!item.isSaved) {
            await ctx.db.patch(item._id, {
                isSaved: true,
                storageMode: "saved",
                expiresAt: undefined,
            });
            await incrementAnalyticsSummary(ctx, { totalSavedItems: 1 });
        }
        return { saved: true, needsUpgrade: false };
    },
});

export const updateItemPosition = mutation({
    args: {
        itemId: v.id("sharedItems"),
        sessionToken: v.string(),
        x: v.number(),
        y: v.number(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await getSessionByToken(ctx, args.sessionToken);
        if (!session) return null;
        const item = await ctx.db.get(args.itemId);
        if (!item || item.sessionId !== session._id) return null;
        await ctx.db.patch(item._id, { canvasX: args.x, canvasY: args.y });
        return null;
    },
});

export const listSavedItems = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("sharedItems"),
            _creationTime: v.number(),
            itemType: itemTypeValidator,
            textContent: v.optional(v.string()),
            fileName: v.optional(v.string()),
            fileSize: v.optional(v.number()),
            mimeType: v.optional(v.string()),
            fileUrl: v.union(v.string(), v.null()),
        })
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];
        const items = await ctx.db
            .query("sharedItems")
            .withIndex("by_user_saved", (q) =>
                q.eq("userId", userId).eq("isSaved", true)
            )
            .order("desc")
            .collect();
        const result = [];
        for (const it of items) {
            if (it.transferStatus === "deleted") continue;
            let url: string | null = null;
            if (it.storageId) {
                url = await ctx.storage.getUrl(it.storageId);
            }
            result.push({
                _id: it._id,
                _creationTime: it._creationTime,
                itemType: it.itemType,
                textContent: it.textContent,
                fileName: it.fileName,
                fileSize: it.fileSize,
                mimeType: it.mimeType,
                fileUrl: url,
            });
        }
        return result;
    },
});

export const deleteSavedItem = mutation({
    args: { itemId: v.id("sharedItems") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");
        const item = await ctx.db.get(args.itemId);
        if (!item) return null;
        if (item.userId !== userId) throw new Error("Forbidden");
        if (item.storageId) {
            try {
                await ctx.storage.delete(item.storageId);
            } catch {
                // ignore
            }
        }
        await ctx.db.patch(item._id, {
            deletedAt: Date.now(),
            transferStatus: "deleted",
        });
        return null;
    },
});
