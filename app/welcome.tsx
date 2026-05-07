import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { GridBackdrop } from "@/components/GridBackdrop";
import { BrandMark } from "@/components/BrandMark";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";

export default function WelcomeScreen() {
  const router = useRouter();
  const { signInWith, isLoading } = useOAuthSignIn();
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | null>(null);

  const goConnect = () => router.push("/connect");

  const handleOAuth = async (provider: "google" | "apple") => {
    try {
      setBusyProvider(provider);
      await signInWith(provider);
      router.replace("/connect");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      Alert.alert("Sign in failed", message);
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <View style={styles.content}>
        <View style={{ alignItems: "flex-start" }}>
          <BrandMark size="lg" />
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
            <Ionicons name="qr-code" size={20} color={theme.accentForeground} />
            <Text style={styles.primaryBtnText}>Connect to website</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              void handleOAuth("google");
            }}
            disabled={isLoading}
          >
            {busyProvider === "google" ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={theme.text} />
                <Text style={styles.secondaryBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {Platform.OS === "ios" && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                void handleOAuth("apple");
              }}
              disabled={isLoading}
            >
              {busyProvider === "apple" ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color={theme.text} />
                  <Text style={styles.secondaryBtnText}>Continue with Apple</Text>
                </>
              )}
            </Pressable>
          )}

          <Pressable style={styles.tertiaryBtn} onPress={() => router.push("/sign-in")}>
            <Ionicons name="mail-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.tertiaryBtnText}>Continue with email</Text>
          </Pressable>
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
  headline: { color: theme.text, fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.5, marginTop: 24, marginBottom: 12 },
  sub: { color: theme.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  featureIcon: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  featureLabel: { color: theme.text, fontSize: 12, fontWeight: "600" },
  actions: { gap: 10 },
  primaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 16, borderRadius: 14 },
  primaryBtnText: { color: theme.accentForeground, fontSize: 15, fontWeight: "700" },
  secondaryBtn: { flexDirection: "row", gap: 8, borderWidth: 1, borderColor: theme.border, paddingVertical: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.panel, minHeight: 54 },
  secondaryBtnText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  tertiaryBtn: { flexDirection: "row", gap: 8, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  tertiaryBtnText: { color: theme.textSecondary, fontSize: 14, fontWeight: "500" },
});