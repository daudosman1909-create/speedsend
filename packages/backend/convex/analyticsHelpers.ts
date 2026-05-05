import type { MutationCtx, QueryCtx } from "./_generated/server";

export interface AnalyticsSummaryValues {
  totalRegisteredUsers: number;
  totalAnonymousUsers: number;
  totalLoginEvents: number;
  totalSessionsCreated: number;
  activeConnectedSessions: number;
  totalItemsShared: number;
  totalFilesShared: number;
  totalLinksShared: number;
  totalTextShared: number;
  totalSavedItems: number;
  totalSharedBytes: number;
}

export const defaultAnalyticsSummary = {
  totalRegisteredUsers: 0,
  totalAnonymousUsers: 0,
  totalLoginEvents: 0,
  totalSessionsCreated: 0,
  activeConnectedSessions: 0,
  totalItemsShared: 0,
  totalFilesShared: 0,
  totalLinksShared: 0,
  totalTextShared: 0,
  totalSavedItems: 0,
  totalSharedBytes: 0,
} satisfies AnalyticsSummaryValues;

const analyticsMetricKeys = [
  "totalRegisteredUsers",
  "totalAnonymousUsers",
  "totalLoginEvents",
  "totalSessionsCreated",
  "activeConnectedSessions",
  "totalItemsShared",
  "totalFilesShared",
  "totalLinksShared",
  "totalTextShared",
  "totalSavedItems",
  "totalSharedBytes",
] as const;

type AnalyticsMetricKey = (typeof analyticsMetricKeys)[number];

type AnalyticsCtx = QueryCtx | MutationCtx;

export async function getAnalyticsSummaryDoc(ctx: AnalyticsCtx) {
  return await ctx.db
    .query("analyticsSummary")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

export async function ensureAnalyticsSummary(ctx: MutationCtx) {
  const existing = await getAnalyticsSummaryDoc(ctx);
  if (existing) return existing;

  const summaryId = await ctx.db.insert("analyticsSummary", {
    key: "global",
    ...defaultAnalyticsSummary,
  });
  const summary = await ctx.db.get(summaryId);
  if (!summary) throw new Error("Failed to initialize analytics summary");
  return summary;
}

export async function incrementAnalyticsSummary(
  ctx: MutationCtx,
  deltas: Partial<Record<AnalyticsMetricKey, number>>
) {
  const summary = await ensureAnalyticsSummary(ctx);
  const patch: Partial<Record<AnalyticsMetricKey, number>> = {};

  for (const key of analyticsMetricKeys) {
    const delta = deltas[key];
    if (delta === undefined || delta === 0) continue;
    patch[key] = Math.max(0, summary[key] + delta);
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(summary._id, patch);
  }
}

export async function replaceAnalyticsSummary(
  ctx: MutationCtx,
  values: AnalyticsSummaryValues
) {
  const summary = await ensureAnalyticsSummary(ctx);
  await ctx.db.patch(summary._id, {
    ...values,
    lastBackfilledAt: Date.now(),
  });
}
