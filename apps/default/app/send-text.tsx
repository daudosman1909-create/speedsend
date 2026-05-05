import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { theme, isLikelyUrl } from "@/lib/theme";
import { useSessionToken } from "@/lib/session-token";
import { GridBackdrop } from "@/components/GridBackdrop";

export default function SendTextScreen() {
  const router = useRouter();
  const { token } = useSessionToken();
  const [text, setText] = useState("");
  const [clear, setClear] = useState(true);
  const [busy, setBusy] = useState(false);
  const sendItem = useMutation(api.items.sendItem);

  const submit = async () => {
    if (!token || !text.trim()) return;
    try {
      setBusy(true);
      await sendItem({
        sessionToken: token,
        senderDevice: "phone",
        itemType: isLikelyUrl(text.trim()) ? "link" : "text",
        textContent: text.trim(),
        canvasX: Math.random() * 0.6 + 0.1,
        canvasY: Math.random() * 0.5 + 0.1,
      });
      if (clear) setText("");
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Couldn't send", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>Send text</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, padding: 18, gap: 12 }}>
          <View style={styles.editorCard}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type or paste anything to send to your computer…"
              placeholderTextColor={theme.textMuted}
              multiline
              autoFocus
              style={styles.editor}
            />
          </View>
          <Pressable onPress={() => setClear((c) => !c)} style={styles.toggleRow}>
            <View style={[styles.toggle, clear && { backgroundColor: theme.accent }]}>
              {clear && <Ionicons name="checkmark" size={12} color="#0a0a0d" />}
            </View>
            <Text style={styles.toggleText}>Clear after send</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, (!text.trim() || busy) && { opacity: 0.5 }]}
            disabled={!text.trim() || busy}
            onPress={submit}
          >
            {busy ? <ActivityIndicator color="#0a0a0d" /> : (
              <>
                <Ionicons name="arrow-up" size={18} color="#0a0a0d" />
                <Text style={styles.primaryBtnText}>Send to computer</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  editorCard: { flex: 1, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16, minHeight: 220 },
  editor: { flex: 1, color: theme.text, fontSize: 16, lineHeight: 22, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}), textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  toggle: { width: 18, height: 18, borderRadius: 6, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
  toggleText: { color: theme.textSecondary, fontSize: 13 },
  primaryBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 16, borderRadius: 14 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 15, fontWeight: "700" },
});
