import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { theme } from "@/lib/theme";
import { setSessionToken, detectDeviceName } from "@/lib/session-token";
import { CameraView, useCameraPermissions } from "expo-camera";
import { GridBackdrop } from "@/components/GridBackdrop";

type Mode = "qr" | "code";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePairingScan(data: string): { code?: string; qrToken?: string } {
  const trimmed = data.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("qr_")) return { qrToken: trimmed };

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      const qr = parsed.qr;
      const qrToken = parsed.qrToken;
      const code = parsed.code;
      if (typeof qr === "string") return { qrToken: qr };
      if (typeof qrToken === "string") return { qrToken };
      if (typeof code === "string") return { code };
    }
  } catch {
    // ignore
  }

  try {
    const url = new URL(trimmed);
    const encoded = url.searchParams.get("data");
    if (encoded) return parsePairingScan(decodeURIComponent(encoded));
  } catch {
    // ignore
  }

  const match = trimmed.match(/data=([^&]+)/);
  if (match) return parsePairingScan(decodeURIComponent(match[1]));

  return { code: trimmed };
}

export default function ConnectScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("qr");
  const [code, setCode] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const pair = useMutation(api.sessions.pairWithCode);

  useEffect(() => {
    if (mode === "qr" && Platform.OS !== "web" && permission && !permission.granted) {
      void requestPermission();
    }
  }, [mode, permission, requestPermission]);

  const submit = async (opts: { code?: string; qrToken?: string }) => {
    try {
      setBusy(true);
      const res = await pair({ ...opts, phoneDeviceName: detectDeviceName() });
      await setSessionToken(res.sessionToken);
      router.replace("/session");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Couldn't connect", msg);
      setScanning(true);
    } finally {
      setBusy(false);
    }
  };

  const handleScan = ({ data }: { data: string }) => {
    if (!scanning || busy) return;
    setScanning(false);

    const parsed = parsePairingScan(data);
    if (parsed.qrToken) {
      void submit({ qrToken: parsed.qrToken });
      return;
    }
    if (parsed.code) {
      void submit({ code: parsed.code });
      return;
    }

    Alert.alert("Couldn't read QR", "Try scanning again or use the code instead.");
    setScanning(true);
  };

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <View style={styles.topRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Connect</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setMode("qr")}
          style={[styles.tab, mode === "qr" && styles.tabActive]}
        >
          <Ionicons name="qr-code-outline" size={16} color={mode === "qr" ? theme.accent : theme.textSecondary} />
          <Text style={[styles.tabText, mode === "qr" && styles.tabTextActive]}>Scan QR</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("code")}
          style={[styles.tab, mode === "code" && styles.tabActive]}
        >
          <Ionicons name="keypad-outline" size={16} color={mode === "code" ? theme.accent : theme.textSecondary} />
          <Text style={[styles.tabText, mode === "code" && styles.tabTextActive]}>Enter code</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        {mode === "qr" ? (
          <View style={styles.scannerCard}>
            {Platform.OS === "web" ? (
              <View style={styles.scannerFallback}>
                <Ionicons name="camera-outline" size={40} color={theme.textMuted} />
                <Text style={styles.fallbackText}>Camera scanning is not available on the web preview. Switch to {`"Enter code"`} or open this in the Bloom mobile app.</Text>
              </View>
            ) : permission?.granted ? (
              <CameraView
                style={styles.scanner}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleScan}
              >
                <View style={styles.scanFrame} />
              </CameraView>
            ) : (
              <View style={styles.scannerFallback}>
                <Ionicons name="camera-outline" size={40} color={theme.textMuted} />
                <Text style={styles.fallbackText}>Camera permission required to scan.</Text>
                <Pressable style={styles.primaryBtn} onPress={() => requestPermission()}>
                  <Text style={styles.primaryBtnText}>Grant access</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.codeCard}>
            <Text style={styles.codeHint}>Enter the 6-character code shown on Relay in your browser.</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="------"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <Pressable
              style={[styles.primaryBtn, (code.length < 6 || busy) && { opacity: 0.5 }]}
              disabled={code.length < 6 || busy}
              onPress={() => submit({ code })}
            >
              {busy ? <ActivityIndicator color="#0a0a0d" /> : <Text style={styles.primaryBtnText}>Connect</Text>}
            </Pressable>
          </View>
        )}
        <Text style={styles.helpText}>
          Open Relay on your computer at the website and scan the QR or enter the code.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: theme.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: theme.border, gap: 4 },
  tab: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 9 },
  tabActive: { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder },
  tabText: { color: theme.textSecondary, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: theme.accent, fontWeight: "600" },
  scannerCard: { aspectRatio: 1, borderRadius: 22, overflow: "hidden", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  scanner: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanFrame: { width: 220, height: 220, borderWidth: 3, borderColor: theme.accent, borderRadius: 18 },
  scannerFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  fallbackText: { color: theme.textSecondary, textAlign: "center", fontSize: 13 },
  codeCard: { padding: 24, borderRadius: 22, gap: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: "center" },
  codeHint: { color: theme.textSecondary, fontSize: 13, textAlign: "center" },
  codeInput: { fontSize: 36, fontWeight: "600", color: theme.text, textAlign: "center", letterSpacing: 8, fontFamily: theme.mono, paddingVertical: 12, width: "100%" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, alignSelf: "stretch" },
  primaryBtnText: { color: "#0a0a0d", fontSize: 15, fontWeight: "700" },
  helpText: { color: theme.textMuted, fontSize: 12, textAlign: "center", paddingHorizontal: 16, lineHeight: 18 },
});
