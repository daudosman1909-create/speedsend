import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { incrementAnalyticsSummary } from "./analyticsHelpers";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateSessionToken(): string {
    return (
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36)
    );
}

function generateCode(): string {
    // 6 chars no ambiguous, e.g. "N2A UUA" => 6 chars
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}

function generateQrToken(): string {
    return (
        "qr_" +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2)
    );
}

export const createBrowserSession = mutation({
    args: {
        deviceName: v.string(),
        browserName: v.string(),
    },
    returns: v.object({
        sessionId: v.id("browserSessions"),
        sessionToken: v.string(),
        code: v.string(),
        qrToken: v.string(),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        const now = Date.now();
        const sessionToken = generateSessionToken();
        const sessionId = await ctx.db.insert("browserSessions", {
            userId: userId ?? undefined,
            sessionToken,
            deviceName: args.deviceName,
            browserName: args.browserName,
            status: "waiting",
            expiresAt: now + SESSION_DURATION_MS,
        });

        const code = generateCode();
        const qrToken = generateQrToken();
        await ctx.db.insert("pairingCodes", {
            sessionId,
            code,
            qrToken,
            expiresAt: now + CODE_EXPIRY_MS,
            status: "active",
        });
        await incrementAnalyticsSummary(ctx, { totalSessionsCreated: 1 });

        return { sessionId, sessionToken, code, qrToken };
    },
});

export const newPairingCode = mutation({
    args: { sessionToken: v.string() },
    returns: v.object({ code: v.string(), qrToken: v.string() }),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("browserSessions")
            .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
            .unique();
        if (!session) throw new Error("Session not found");
        // Expire all old active codes for this session
        const old = await ctx.db
            .query("pairingCodes")
            .withIndex("by_session_and_status", (q) =>
                q.eq("sessionId", session._id).eq("status", "active")
            )
            .collect();
        for (const c of old) {
            await ctx.db.patch(c._id, { status: "expired" });
        }
        const code = generateCode();
        const qrToken = generateQrToken();
        await ctx.db.insert("pairingCodes", {
            sessionId: session._id,
            code,
            qrToken,
            expiresAt: Date.now() + CODE_EXPIRY_MS,
            status: "active",
        });
        return { code, qrToken };
    },
});

export const getSessionByToken = query({
    args: { sessionToken: v.string() },
    returns: v.union(
        v.null(),
        v.object({
            _id: v.id("browserSessions"),
            _creationTime: v.number(),
            status: v.union(
                v.literal("waiting"),
                v.literal("connected"),
                v.literal("disconnected"),
                v.literal("expired")
            ),
            deviceName: v.string(),
            browserName: v.string(),
            phoneDeviceName: v.optional(v.string()),
            expiresAt: v.number(),
            connectedAt: v.optional(v.number()),
            endedAt: v.optional(v.number()),
            code: v.optional(v.string()),
            qrToken: v.optional(v.string()),
            isProUser: v.boolean(),
        })
    ),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("browserSessions")
            .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
            .unique();
        if (!session) return null;
        const activeCode = await ctx.db
            .query("pairingCodes")
            .withIndex("by_session_and_status", (q) =>
                q.eq("sessionId", session._id).eq("status", "active")
            )
            .order("desc")
            .first();
        let isProUser = false;
        if (session.userId) {
            const sub = await ctx.db
                .query("subscriptions")
                .withIndex("by_user", (q) => q.eq("userId", session.userId!))
                .order("desc")
                .first();
            if (sub && sub.status === "active" && sub.plan === "pro") {
                isProUser = true;
            }
        }
        return {
            _id: session._id,
            _creationTime: session._creationTime,
            status: session.status,
            deviceName: session.deviceName,
            browserName: session.browserName,
            phoneDeviceName: session.phoneDeviceName,
            expiresAt: session.expiresAt,
            connectedAt: session.connectedAt,
            endedAt: session.endedAt,
            code: activeCode?.code,
            qrToken: activeCode?.qrToken,
            isProUser,
        };
    },
});

export const pairWithCode = mutation({
    args: {
        code: v.optional(v.string()),
        qrToken: v.optional(v.string()),
        phoneDeviceName: v.string(),
    },
    returns: v.object({
        sessionId: v.id("browserSessions"),
        sessionToken: v.string(),
    }),
    handler: async (ctx, args) => {
        const now = Date.now();
        let pairing;
        if (args.code) {
            const normalized = args.code.replace(/\s+/g, "").toUpperCase();
            pairing = await ctx.db
                .query("pairingCodes")
                .withIndex("by_code", (q) => q.eq("code", normalized))
                .first();
        } else if (args.qrToken) {
            pairing = await ctx.db
                .query("pairingCodes")
                .withIndex("by_qr", (q) => q.eq("qrToken", args.qrToken!))
                .first();
        } else {
            throw new Error("Provide a code or QR token");
        }
        if (!pairing) throw new Error("Invalid pairing code");
        if (pairing.status !== "active")
            throw new Error("This code is no longer active");
        if (pairing.expiresAt < now) {
            await ctx.db.patch(pairing._id, { status: "expired" });
            throw new Error("This code has expired");
        }

        const session = await ctx.db.get(pairing.sessionId);
        if (!session) throw new Error("Session not found");
        if (session.status === "expired")
            throw new Error("Session has expired");
        const wasConnected = session.status === "connected";

        await ctx.db.patch(pairing._id, { status: "used", usedAt: now });

        const userId = await getAuthUserId(ctx);
        await ctx.db.patch(session._id, {
            status: "connected",
            connectedAt: now,
            phoneDeviceName: args.phoneDeviceName,
            // If phone is logged in and session has no user, link the user
            userId: session.userId ?? userId ?? undefined,
        });
        if (!wasConnected) {
            await incrementAnalyticsSummary(ctx, { activeConnectedSessions: 1 });
        }

        return { sessionId: session._id, sessionToken: session.sessionToken };
    },
});

export const disconnectSession = mutation({
    args: { sessionToken: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("browserSessions")
            .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
            .unique();
        if (!session) return null;
        const now = Date.now();
        await ctx.db.patch(session._id, {
            status: "disconnected",
            endedAt: now,
        });
        if (session.status === "connected") {
            await incrementAnalyticsSummary(ctx, { activeConnectedSessions: -1 });
        }
        // Delete temporary items
        await deleteTemporaryItems(ctx, session._id);
        return null;
    },
});

async function deleteTemporaryItems(
    ctx: MutationCtx,
    sessionId: Id<"browserSessions">
) {
    const items = await ctx.db
        .query("sharedItems")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
    for (const item of items) {
        if (item.storageMode === "temporary" && !item.isSaved) {
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
        }
    }
}

export const endSessionByPhone = mutation({
    args: { sessionId: v.id("browserSessions") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db.get(args.sessionId);
        if (!session) return null;
        await ctx.db.patch(session._id, {
            status: "disconnected",
            endedAt: Date.now(),
        });
        if (session.status === "connected") {
            await incrementAnalyticsSummary(ctx, { activeConnectedSessions: -1 });
        }
        await deleteTemporaryItems(ctx, session._id);
        return null;
    },
});

export const heartbeat = mutation({
    args: { sessionToken: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("browserSessions")
            .withIndex("by_token", (q) => q.eq("sessionToken", args.sessionToken))
            .unique();
        if (!session) return null;
        if (session.status === "connected" || session.status === "waiting") {
            const now = Date.now();
            await ctx.db.patch(session._id, {
                expiresAt: now + SESSION_DURATION_MS,
            });
        }
        return null;
    },
});
