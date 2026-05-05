import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { incrementAnalyticsSummary } from "./analyticsHelpers";
import { authMutation } from "./functions";

export const getMySubscription = query({
    args: {},
    returns: v.union(
        v.null(),
        v.object({
            plan: v.union(v.literal("free"), v.literal("pro")),
            status: v.union(
                v.literal("active"),
                v.literal("canceled"),
                v.literal("past_due")
            ),
            renewsAt: v.optional(v.number()),
            isPro: v.boolean(),
        })
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .first();
        if (!sub) return { plan: "free" as const, status: "active" as const, isPro: false };
        return {
            plan: sub.plan,
            status: sub.status,
            renewsAt: sub.renewsAt,
            isPro: sub.plan === "pro" && sub.status === "active",
        };
    },
});

// Demo upgrade for now - in production this would integrate with Stripe via webhooks
export const upgradeToPro = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Sign in to upgrade");
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .first();
        const now = Date.now();
        const renewsAt = now + 30 * 24 * 60 * 60 * 1000;
        if (existing) {
            await ctx.db.patch(existing._id, {
                plan: "pro",
                status: "active",
                priceCents: 250,
                currency: "EUR",
                billingInterval: "monthly",
                startedAt: now,
                renewsAt,
                canceledAt: undefined,
            });
        } else {
            await ctx.db.insert("subscriptions", {
                userId,
                plan: "pro",
                priceCents: 250,
                currency: "EUR",
                billingInterval: "monthly",
                status: "active",
                startedAt: now,
                renewsAt,
            });
        }
        return null;
    },
});

export const cancelPro = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Sign in required");
        const sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .first();
        if (!sub) return null;
        await ctx.db.patch(sub._id, {
            status: "canceled",
            plan: "free",
            canceledAt: Date.now(),
        });
        return null;
    },
});

export const syncAuthActivity = authMutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const now = Date.now();
        const isAnonymous = !!ctx.user.isAnonymous;
        const existing = await ctx.db
            .query("userAnalytics")
            .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                email: ctx.user.email,
                name: ctx.user.name,
                isAnonymous,
                lastLoginAt: now,
                loginCount: existing.loginCount + 1,
            });
            await incrementAnalyticsSummary(ctx, { totalLoginEvents: 1 });
            return null;
        }

        await ctx.db.insert("userAnalytics", {
            userId: ctx.user._id,
            email: ctx.user.email,
            name: ctx.user.name,
            isAnonymous,
            firstSeenAt: now,
            lastLoginAt: now,
            loginCount: 1,
        });
        await incrementAnalyticsSummary(ctx, {
            totalLoginEvents: 1,
            ...(isAnonymous
                ? { totalAnonymousUsers: 1 }
                : { totalRegisteredUsers: 1 }),
        });
        return null;
    },
});

export const getMe = query({
    args: {},
    returns: v.union(
        v.null(),
        v.object({
            _id: v.id("users"),
            email: v.optional(v.string()),
            name: v.optional(v.string()),
            image: v.optional(v.string()),
            isAnonymous: v.optional(v.boolean()),
            isPro: v.boolean(),
            isAdmin: v.boolean(),
        })
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const user = await ctx.db.get(userId);
        if (!user) return null;
        const sub = await ctx.db
            .query("subscriptions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .first();
        const adminAccess = await ctx.db
            .query("adminUsers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .unique();
        const isPro = !!(sub && sub.status === "active" && sub.plan === "pro");
        return {
            _id: user._id,
            email: user.email,
            name: user.name,
            image: user.image,
            isAnonymous: user.isAnonymous,
            isPro,
            isAdmin: !!adminAccess,
        };
    },
});
