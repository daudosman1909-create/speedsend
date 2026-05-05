import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import {
  defaultAnalyticsSummary,
  replaceAnalyticsSummary,
  getAnalyticsSummaryDoc,
} from "./analyticsHelpers";
import { authQuery } from "./functions";

const DEFAULT_ADMIN_USERNAME = "admindaud";
const DEFAULT_ADMIN_EMAIL = "admindaud@speedsend.local";
const DEFAULT_ADMIN_PASSWORD = "loginpassdaud";

const analyticsSummaryValidator = v.object({
  totalRegisteredUsers: v.number(),
  totalAnonymousUsers: v.number(),
  totalLoginEvents: v.number(),
  totalSessionsCreated: v.number(),
  activeConnectedSessions: v.number(),
  totalItemsShared: v.number(),
  totalFilesShared: v.number(),
  totalLinksShared: v.number(),
  totalTextShared: v.number(),
  totalSavedItems: v.number(),
  totalSharedBytes: v.number(),
});

function isFileLikeItemType(itemType: string) {
  return itemType !== "text" && itemType !== "link";
}

export const getAnalyticsDashboard = authQuery({
  args: {},
  returns: v.object({
    summary: analyticsSummaryValidator,
    recentUsers: v.array(
      v.object({
        userId: v.id("users"),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        isAnonymous: v.boolean(),
        firstSeenAt: v.number(),
        lastLoginAt: v.number(),
        loginCount: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const adminAccess = await ctx.db
      .query("adminUsers")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!adminAccess) throw new Error("Admin access required");

    const summary = await getAnalyticsSummaryDoc(ctx);
    const recentUsers = await ctx.db
      .query("userAnalytics")
      .withIndex("by_lastLoginAt")
      .order("desc")
      .take(8);

    return {
      summary: summary
        ? {
            totalRegisteredUsers: summary.totalRegisteredUsers,
            totalAnonymousUsers: summary.totalAnonymousUsers,
            totalLoginEvents: summary.totalLoginEvents,
            totalSessionsCreated: summary.totalSessionsCreated,
            activeConnectedSessions: summary.activeConnectedSessions,
            totalItemsShared: summary.totalItemsShared,
            totalFilesShared: summary.totalFilesShared,
            totalLinksShared: summary.totalLinksShared,
            totalTextShared: summary.totalTextShared,
            totalSavedItems: summary.totalSavedItems,
            totalSharedBytes: summary.totalSharedBytes,
          }
        : defaultAnalyticsSummary,
      recentUsers: recentUsers.map((user) => ({
        userId: user.userId,
        email: user.email,
        name: user.name,
        isAnonymous: user.isAnonymous,
        firstSeenAt: user.firstSeenAt,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount,
      })),
    };
  },
});

export const grantAdminAccess = internalMutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("adminUsers", {
        userId: args.userId,
        username: args.username,
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

export const backfillAnalyticsSummary = internalMutation({
  args: {},
  returns: analyticsSummaryValidator,
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const existingAnalyticsRows = await ctx.db.query("userAnalytics").collect();
    const analyticsByUserId = new Map(
      existingAnalyticsRows.map((row) => [row.userId, row])
    );

    for (const user of users) {
      if (analyticsByUserId.has(user._id)) continue;
      const analyticsId = await ctx.db.insert("userAnalytics", {
        userId: user._id,
        email: user.email,
        name: user.name,
        isAnonymous: !!user.isAnonymous,
        firstSeenAt: user._creationTime,
        lastLoginAt: user._creationTime,
        loginCount: 0,
      });
      const insertedAnalytics = await ctx.db.get(analyticsId);
      if (insertedAnalytics) {
        existingAnalyticsRows.push(insertedAnalytics);
      }
    }

    const sessions = await ctx.db.query("browserSessions").collect();
    const items = await ctx.db.query("sharedItems").collect();
    const existingLoginEvents = existingAnalyticsRows.reduce(
      (total, row) => total + row.loginCount,
      0
    );
    const registeredUsers = users.filter((user) => !user.isAnonymous).length;
    const anonymousUsers = users.filter((user) => !!user.isAnonymous).length;
    const summary = {
      totalRegisteredUsers: registeredUsers,
      totalAnonymousUsers: anonymousUsers,
      totalLoginEvents: Math.max(existingLoginEvents, registeredUsers),
      totalSessionsCreated: sessions.length,
      activeConnectedSessions: sessions.filter(
        (session) => session.status === "connected"
      ).length,
      totalItemsShared: items.length,
      totalFilesShared: items.filter((item) => isFileLikeItemType(item.itemType))
        .length,
      totalLinksShared: items.filter((item) => item.itemType === "link").length,
      totalTextShared: items.filter((item) => item.itemType === "text").length,
      totalSavedItems: items.filter((item) => item.isSaved).length,
      totalSharedBytes: items.reduce(
        (total, item) => total + (item.fileSize ?? 0),
        0
      ),
    };

    await replaceAnalyticsSummary(ctx, summary);
    return summary;
  },
});

export const seedDefaultAdminAccount = internalAction({
  args: {},
  returns: v.object({
    username: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx) => {
    const existing = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: DEFAULT_ADMIN_EMAIL },
    });

    let userId;
    let created = false;

    if (existing === null) {
      const createdAccount = await createAccount(ctx, {
        provider: "password",
        account: {
          id: DEFAULT_ADMIN_EMAIL,
          secret: DEFAULT_ADMIN_PASSWORD,
        },
        profile: {
          email: DEFAULT_ADMIN_EMAIL,
          name: DEFAULT_ADMIN_USERNAME,
        },
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      });
      userId = createdAccount.user._id;
      created = true;
    } else {
      userId = existing.user._id;
    }

    await ctx.runMutation(internal.admin.grantAdminAccess, {
      userId,
      username: DEFAULT_ADMIN_USERNAME,
    });
    await ctx.runMutation(internal.admin.backfillAnalyticsSummary, {});

    return {
      username: DEFAULT_ADMIN_USERNAME,
      created,
    };
  },
});
