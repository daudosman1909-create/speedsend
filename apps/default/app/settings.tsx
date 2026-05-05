import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { theme } from "@/lib/theme";
import { useSessionToken } from "@/lib/session-token";
import { GridBackdrop } from "@/components/GridBackdrop";

export default function SettingsScreen() {
  const router = useRouter();
  const { token, setToken } = useSessionToken();
  const me = useQuery(api.users.getMe);
  const session = useQuery(api.sessions.getSessionByToken, token ? { sessionToken: token } : "skip");
  const disconnect = useMutation(api.sessions.disconnectSession);
  const cancelPro = useMutation(api.users.cancelPro);
  const { signOut } = useAuthActions();

  const handleDisconnect = async () => {
    if (!token) return;
    Alert.alert("Disconnect?", "This will end the current session and delete temporary items.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await disconnect({ sessionToken: token });
          await setToken(null);
          router.replace("/welcome");
        },
      },
    ]);
  };

  const handleSignOut = async () => {
    await signOut();
    await setToken(null);
    router.replace("/welcome");
  };

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          {me ? (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(me.name ?? me.email ?? "U").slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{me.name ?? "Anonymous"}</Text>
                <Text style={styles.rowSub}>{me.email ?? (me.isAnonymous ? "Anonymous user" : "Signed in")}</Text>
              </View>
            </View>
          ) : (
            <Pressable style={styles.row} onPress={() => router.push("/sign-in")}>
              <View style={[styles.avatar, { backgroundColor: theme.cardElevated }]}>
                <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Sign in</Text>
                <Text style={styles.rowSub}>Save items across sessions</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder }]}>
              <Ionicons name={me?.isPro ? "sparkles" : "flash-outline"} size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{me?.isPro ? "Relay Pro" : "Free plan"}</Text>
              <Text style={styles.rowSub}>{me?.isPro ? "€2.50/month · saved storage" : "Temporary transfers only"}</Text>
            </View>
            {me?.isPro ? (
              <Pressable onPress={async () => {
                await cancelPro({});
                Alert.alert("Plan canceled", "You're back on the free plan.");
              }}>
                <Text style={styles.linkText}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push("/upgrade")}>
                <Text style={[styles.linkText, { color: theme.accent }]}>Upgrade</Text>
              </Pressable>
            )}
          </View>
        </View>

        {me?.isPro && (
          <Pressable style={styles.card} onPress={() => router.push("/storage")}>
            <View style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name="server-outline" size={16} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Saved storage</Text>
                <Text style={styles.rowSub}>Browse and manage your saved items</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </View>
          </Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SESSION</Text>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="link-outline" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Status</Text>
              <Text style={styles.rowSub}>{session?.status ?? "Not connected"}</Text>
            </View>
          </View>
          {session?.status === "connected" && (
            <Pressable style={styles.dangerBtn} onPress={handleDisconnect}>
              <Ionicons name="close-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.dangerBtnText}>Disconnect from computer</Text>
            </Pressable>
          )}
        </View>

        {me ? (
          <Pressable style={[styles.card, { alignItems: "center" }]} onPress={handleSignOut}>
            <Text style={[styles.linkText, { color: theme.danger }]}>Sign out</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, gap: 12 },
  sectionLabel: { color: theme.textMuted, fontSize: 10, fontFamily: theme.mono, letterSpacing: 1.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.cardElevated, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: theme.text, fontSize: 14, fontWeight: "600" },
  rowSub: { color: theme.textMuted, fontSize: 12 },
  linkText: { color: theme.textSecondary, fontSize: 13, fontWeight: "500" },
  dangerBtn: { flexDirection: "row", gap: 6, alignSelf: "flex-start", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,94,108,0.08)", borderWidth: 1, borderColor: "rgba(255,94,108,0.25)" },
  dangerBtnText: { color: theme.danger, fontSize: 12, fontWeight: "600" },
});
