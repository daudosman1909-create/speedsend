import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { GridBackdrop } from "@/components/GridBackdrop";
import { formatBytes, theme } from "@/lib/theme";

interface MetricCardConfig {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent?: boolean;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const me = useQuery(api.users.getMe);
  const dashboard = useQuery(
    api.admin.getAnalyticsDashboard,
    me?.isAdmin ? {} : "skip"
  );

  if (me === undefined || (me?.isAdmin && dashboard === undefined)) {
    return (
      <View style={styles.loadingContainer}>
        <GridBackdrop />
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!me?.isAdmin) {
    return (
      <View style={styles.container}>
        <GridBackdrop />
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.lockedState}>
          <View style={styles.lockedIcon}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.accent} />
          </View>
          <Text style={styles.lockedTitle}>Admin access required</Text>
          <Text style={styles.lockedCopy}>
            This dashboard is only visible to the admin account.
          </Text>
        </View>
      </View>
    );
  }

  const summary = dashboard?.summary;
  const metrics: MetricCardConfig[] = [
    {
      label: "Registered accounts",
      value: String(summary?.totalRegisteredUsers ?? 0),
      icon: "people-outline",
      accent: true,
    },
    {
      label: "Guest accounts",
      value: String(summary?.totalAnonymousUsers ?? 0),
      icon: "person-outline",
    },
    {
      label: "Login events",
      value: String(summary?.totalLoginEvents ?? 0),
      icon: "log-in-outline",
    },
    {
      label: "Sessions created",
      value: String(summary?.totalSessionsCreated ?? 0),
      icon: "desktop-outline",
    },
    {
      label: "Live paired sessions",
      value: String(summary?.activeConnectedSessions ?? 0),
      icon: "link-outline",
    },
    {
      label: "Items shared",
      value: String(summary?.totalItemsShared ?? 0),
      icon: "share-social-outline",
    },
    {
      label: "Files shared",
      value: String(summary?.totalFilesShared ?? 0),
      icon: "folder-open-outline",
    },
    {
      label: "Links shared",
      value: String(summary?.totalLinksShared ?? 0),
      icon: "link-outline",
    },
    {
      label: "Text shared",
      value: String(summary?.totalTextShared ?? 0),
      icon: "document-text-outline",
    },
    {
      label: "Saved items",
      value: String(summary?.totalSavedItems ?? 0),
      icon: "bookmark-outline",
    },
    {
      label: "Bytes shared",
      value: formatBytes(summary?.totalSharedBytes ?? 0),
      icon: "server-outline",
    },
  ];
  const columns = width >= 1024 ? 3 : width >= 720 ? 2 : 1;
  const cardBasis = columns === 3 ? "31.5%" : columns === 2 ? "48.5%" : "100%";

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.adminPill}>
          <Text style={styles.adminPillText}>admindaud</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>ADMIN OVERVIEW</Text>
          <Text style={styles.heroTitle}>Live SpeedSend usage</Text>
          <Text style={styles.heroCopy}>
            Accounts, sessions, transfers, and saved activity across mobile and desktop.
          </Text>
        </View>

        <View style={styles.metricsWrap}>
          {metrics.map((metric) => (
            <View key={metric.label} style={[styles.metricCard, { flexBasis: cardBasis }]}>
              <View style={styles.metricHeader}>
                <View
                  style={[
                    styles.metricIcon,
                    metric.accent && styles.metricIconAccent,
                  ]}
                >
                  <Ionicons
                    name={metric.icon}
                    size={16}
                    color={metric.accent ? theme.accent : theme.textSecondary}
                  />
                </View>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
              <Text
                style={[
                  styles.metricValue,
                  metric.accent && styles.metricValueAccent,
                ]}
              >
                {metric.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionLabel}>RECENT USERS</Text>
          {(dashboard?.recentUsers ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No login activity yet.</Text>
          ) : (
            <View style={styles.listWrap}>
              {dashboard?.recentUsers.map((user) => (
                <View key={user.userId} style={styles.userRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(user.name ?? user.email ?? "U").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userMeta}>
                    <Text style={styles.userName}>
                      {user.name ?? user.email ?? "Anonymous user"}
                    </Text>
                    <Text style={styles.userSub}>
                      {user.isAnonymous
                        ? "Guest"
                        : user.email ?? "Password / OAuth account"}
                    </Text>
                  </View>
                  <View style={styles.userStats}>
                    <Text style={styles.userStatValue}>{user.loginCount}</Text>
                    <Text style={styles.userStatLabel}>logins</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
  },
  adminPill: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accentBorder,
    alignItems: "center",
  },
  adminPillText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  heroEyebrow: {
    color: theme.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily: theme.mono,
  },
  heroTitle: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  heroCopy: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.cardElevated,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconAccent: {
    backgroundColor: theme.accentSoft,
    borderColor: theme.accentBorder,
  },
  metricLabel: {
    flex: 1,
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  metricValueAccent: {
    color: theme.accent,
  },
  listCard: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: theme.textMuted,
    fontSize: 11,
    fontFamily: theme.mono,
    letterSpacing: 1.2,
  },
  listWrap: {
    gap: 10,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: theme.accentForeground,
    fontSize: 14,
    fontWeight: "700",
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  userSub: {
    color: theme.textMuted,
    fontSize: 12,
  },
  userStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  userStatValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "700",
  },
  userStatLabel: {
    color: theme.textMuted,
    fontSize: 11,
    fontFamily: theme.mono,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 13,
  },
  lockedState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  lockedIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: theme.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
  },
  lockedCopy: {
    color: theme.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
