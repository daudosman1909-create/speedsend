import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { theme } from "@/lib/theme";
import { GridBackdrop } from "@/components/GridBackdrop";
import { useOAuthSignIn } from "@/hooks/use-oauth-sign-in";
import { BrandMark } from "@/components/BrandMark";

type Mode = "signIn" | "signUp";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { signInWith, isLoading: oauthLoading } = useOAuthSignIn();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | null>(null);

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      Alert.alert("Check details", "Enter a valid login and a password (8+ chars).");
      return;
    }
    const rawLogin = email.trim();
    const normalizedLogin =
      rawLogin.toLowerCase() === "admindaud"
        ? "admindaud@speedsend.local"
        : rawLogin;
    try {
      setBusy(true);
      await signIn("password", { email: normalizedLogin, password, flow: mode === "signUp" ? "signUp" : "signIn" });
      router.replace("/connect");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (mode === "signIn" && /not found|invalid/i.test(msg)) {
        Alert.alert("Account not found", "Want to create one?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign up", onPress: () => setMode("signUp") },
        ]);
      } else if (mode === "signUp" && /exists/i.test(msg)) {
        Alert.alert("Already exists", "Try signing in instead.");
        setMode("signIn");
      } else {
        Alert.alert("Couldn't sign in", msg || "Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

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
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <BrandMark size="md" />

        <Pressable
          style={styles.socialBtn}
          onPress={() => {
            void handleOAuth("google");
          }}
          disabled={oauthLoading}
        >
          {busyProvider === "google" ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {Platform.OS === "ios" && (
          <Pressable
            style={styles.socialBtn}
            onPress={() => {
              void handleOAuth("apple");
            }}
            disabled={oauthLoading}
          >
            {busyProvider === "apple" ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={18} color={theme.text} />
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </>
            )}
          </Pressable>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or use email</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email or username</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com or admindaud"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />
        </View>
        <Pressable style={[styles.primaryBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color={theme.accentForeground} /> : <Text style={styles.primaryBtnText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
          <Text style={styles.toggleText}>
            {mode === "signIn" ? "No account? Create one" : "Have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  body: { padding: 24, gap: 14 },
  socialBtn: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.panel, borderWidth: 1, borderColor: theme.border, borderRadius: 14 },
  socialBtnText: { color: theme.text, fontSize: 15, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { color: theme.textMuted, fontSize: 12, fontFamily: theme.mono, letterSpacing: 0.6 },
  card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 16, gap: 8 },
  label: { color: theme.textMuted, fontSize: 11, fontFamily: theme.mono, letterSpacing: 1, marginTop: 4 },
  input: { backgroundColor: theme.cardElevated, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  primaryBtn: { alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 12 },
  primaryBtnText: { color: theme.accentForeground, fontSize: 15, fontWeight: "700" },
  toggleText: { color: theme.accent, fontSize: 13, textAlign: "center", paddingVertical: 6 },
});
