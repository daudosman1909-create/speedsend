import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { theme } from "@/lib/theme";

type Mode = "signIn" | "signUp";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("Check details", "Enter a valid email and a password (6+ chars).");
      return;
    }
    try {
      setBusy(true);
      await signIn("password", { email: email.trim(), password, flow: mode === "signUp" ? "signUp" : "signIn" });
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

  const continueAnon = async () => {
    try {
      setBusy(true);
      await signIn("anonymous");
      router.replace("/connect");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
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
          {busy ? <ActivityIndicator color="#0a0a0d" /> : <Text style={styles.primaryBtnText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
          <Text style={styles.toggleText}>
            {mode === "signIn" ? "No account? Create one" : "Have an account? Sign in"}
          </Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.tertiaryBtn} onPress={continueAnon}>
          <Text style={styles.tertiaryBtnText}>Continue without an account</Text>
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
  card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 16, gap: 8 },
  label: { color: theme.textMuted, fontSize: 11, fontFamily: theme.mono, letterSpacing: 1, marginTop: 4 },
  input: { backgroundColor: theme.cardElevated, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  primaryBtn: { alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 14, borderRadius: 12 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 15, fontWeight: "700" },
  toggleText: { color: theme.accent, fontSize: 13, textAlign: "center", paddingVertical: 6 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 8 },
  tertiaryBtn: { paddingVertical: 14, alignItems: "center" },
  tertiaryBtnText: { color: theme.textSecondary, fontSize: 13 },
});
