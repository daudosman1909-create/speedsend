import React from "react";
import { View, Text, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { theme } from "../../lib/theme";
import { setSessionToken } from "../../lib/session-token";
import { useEffect, useState } from "react";

export default function WelcomeScreen() {
  const router = useRouter();
  const createDeviceSession = useMutation(api.sessions.createDeviceSession);
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);

  const goConnect = () => router.push("/connect");

  const continueTemporary = async () => {
    try {
      setBusy(true);
      await signIn("anonymous");
      const res = await createDeviceSession({ deviceName: Platform.OS === "ios" ? "iPhone" : "Android", platform: Platform.OS });
      await setSessionToken(res.sessionToken);
      router.replace("/connect");
    } catch (e) {
      Alert.alert("Error", "Could not continue. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridBg} pointerEvents="none" />
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Ionicons name="flash" size={36} color="#fff" />
        </View>
        <Text style={styles.brand}>Relay</Text>
        <Text style={styles.headline}>Move anything between your phone and computer.</Text>
        <Text style={styles.sub}>Pair your phone with a browser and send files, photos, links, audio, video, and text instantly.</Text>

        <View style={styles.featureRow}>
          <Feature icon="document-text" label="Text" />
          <Feature icon="image" label="Photos" />
          <Feature icon="videocam" label="Video" />
          <Feature icon="musical-notes" label="Audio" />
          <Feature icon="link" label="Links" />
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.primaryBtn]} onPress={goConnect}>
            <Ionicons name="qr-code" size={20} color="#0a0a0d" />
            <Text style={styles.primaryBtnText}>Connect to website</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push("/sign-in")}>
            <Text style={styles.secondaryBtnText}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.tertiaryBtn} onPress={continueTemporary} disabled={busy}>
            {busy ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.tertiaryBtnText}>Continue temporary</Text>}
          </Pressable>
        </View>

        <Text style={styles.footer}>Built with bloom.diy</Text>
      </View>
    </View>
  );
}

function Feature({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  gridBg: {
    position: "absolute",
    inset: 0 as any,
    opacity: 0.4,
  },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40, justifyContent: "space-between" },
  logoBox: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
    shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  brand: { color: theme.textPrimary, fontSize: 32, fontWeight: "700", letterSpacing: -1, marginBottom: 24 },
  headline: { color: theme.textPrimary, fontSize: 30, fontWeight: "700", lineHeight: 36, letterSpacing: -0.5, marginBottom: 12 },
  sub: { color: theme.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 32 },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 32 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  featureIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  featureLabel: { color: theme.textPrimary, fontSize: 12, fontWeight: "600" },
  actions: { gap: 10, marginBottom: 24 },
  primaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 16, borderRadius: 14 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: theme.border, paddingVertical: 16, borderRadius: 14, alignItems: "center", backgroundColor: theme.panel },
  secondaryBtnText: { color: theme.textPrimary, fontSize: 15, fontWeight: "600" },
  tertiaryBtn: { paddingVertical: 14, alignItems: "center" },
  tertiaryBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: "500" },
  footer: { color: theme.textTertiary, fontSize: 12, textAlign: "center" },
});
