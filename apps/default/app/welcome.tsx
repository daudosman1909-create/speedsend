import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { theme } from "@/lib/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);

  const goConnect = () => router.push("/connect");

  const continueTemporary = async () => {
    try {
      setBusy(true);
      await signIn("anonymous");
      router.replace("/connect");
    } catch {
      Alert.alert("Error", "Could not continue. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setBusy(true);
      await signIn("anonymous");
      router.replace("/connect");
    } catch {
      Alert.alert("Sign in unavailable", "For now you can continue with a temporary session.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={{ alignItems: "flex-start" }}>
          <View style={styles.logoBox}>
            <Ionicons name="flash" size={32} color="#fff" />
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
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={goConnect}>
            <Ionicons name="qr-code" size={20} color="#0a0a0d" />
            <Text style={styles.primaryBtnText}>Connect to website</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleSignIn} disabled={busy}>
            <Text style={styles.secondaryBtnText}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.tertiaryBtn} onPress={continueTemporary} disabled={busy}>
            {busy ? <ActivityIndicator color={theme.accent} /> : <Text style={styles.tertiaryBtnText}>Continue temporary</Text>}
          </Pressable>
          <Text style={styles.footer}>Built with bloom.diy</Text>
        </View>
      </View>
    </View>
  );
}

function Feature({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={16} color={theme.accent} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40, justifyContent: "space-between" },
  logoBox: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: theme.accent,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  brand: { color: theme.text, fontSize: 28, fontWeight: "700", letterSpacing: -1, marginBottom: 18 },
  headline: { color: theme.text, fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.5, marginBottom: 12 },
  sub: { color: theme.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  featureIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  featureLabel: { color: theme.text, fontSize: 12, fontWeight: "600" },
  actions: { gap: 10 },
  primaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 16, borderRadius: 14 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: theme.border, paddingVertical: 16, borderRadius: 14, alignItems: "center", backgroundColor: theme.panel },
  secondaryBtnText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  tertiaryBtn: { paddingVertical: 14, alignItems: "center" },
  tertiaryBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: "500" },
  footer: { color: theme.textMuted, fontSize: 11, textAlign: "center", marginTop: 8 },
});
