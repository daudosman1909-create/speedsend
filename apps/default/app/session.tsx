import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Alert, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { theme, formatBytes, formatRelativeTime, isLikelyUrl } from "@/lib/theme";
import { useSessionToken } from "@/lib/session-token";
import { uploadFileFromUri } from "@/lib/upload";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";

type SessionItem = NonNullable<ReturnType<typeof useQuery<typeof api.items.listSessionItems>>>[number];

export default function SessionScreen() {
  const router = useRouter();
  const { token, setToken, loading } = useSessionToken();
  const convex = useConvex();
  const session = useQuery(api.sessions.getSessionByToken, token ? { sessionToken: token } : "skip");
  const items = useQuery(api.items.listSessionItems, token ? { sessionToken: token } : "skip");
  const sendItem = useMutation(api.items.sendItem);
  const deleteItem = useMutation(api.items.deleteItem);
  const saveItem = useMutation(api.items.saveItem);
  const disconnect = useMutation(api.sessions.disconnectSession);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const connected = session?.status === "connected";
  const expired = session?.status === "expired" || session?.status === "disconnected";

  const sendFile = useCallback(
    async (opts: { uri: string; mimeType: string; name?: string; size?: number; itemType: "image" | "video" | "audio" | "file" | "document" | "pdf" }) => {
      if (!token) return;
      setUploading(true);
      try {
        const { storageId } = await uploadFileFromUri(convex, opts.uri, opts.mimeType);
        await sendItem({
          sessionToken: token,
          senderDevice: "phone",
          itemType: opts.itemType,
          storageId,
          fileName: opts.name ?? "file",
          fileSize: opts.size,
          mimeType: opts.mimeType,
          canvasX: Math.random() * 0.6 + 0.1,
          canvasY: Math.random() * 0.5 + 0.1,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Try again.";
        Alert.alert("Upload failed", msg);
      } finally {
        setUploading(false);
      }
    },
    [convex, sendItem, token],
  );

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled) return;
    const a = res.assets[0];
    await sendFile({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg", name: a.fileName ?? "photo.jpg", size: a.fileSize, itemType: "image" });
  };

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.85 });
    if (res.canceled) return;
    const a = res.assets[0];
    await sendFile({ uri: a.uri, mimeType: a.mimeType ?? "video/mp4", name: a.fileName ?? "video.mp4", size: a.fileSize, itemType: "video" });
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (res.canceled) return;
    const a = res.assets[0];
    const mime = a.mimeType ?? "application/octet-stream";
    const itemType = mime.startsWith("audio/")
      ? "audio"
      : mime === "application/pdf"
        ? "pdf"
        : mime.startsWith("video/")
          ? "video"
          : mime.startsWith("image/")
            ? "image"
            : mime.includes("text") || mime.includes("document") || mime.includes("word")
              ? "document"
              : "file";
    await sendFile({ uri: a.uri, mimeType: mime, name: a.name, size: a.size, itemType });
  };

  const sendClipboardText = async () => {
    if (!token) return;
    const text = await Clipboard.getStringAsync();
    if (!text) {
      Alert.alert("Clipboard empty", "Copy something first, then tap Send link/text.");
      return;
    }
    await sendItem({
      sessionToken: token,
      senderDevice: "phone",
      itemType: isLikelyUrl(text) ? "link" : "text",
      textContent: text,
      canvasX: Math.random() * 0.6 + 0.1,
      canvasY: Math.random() * 0.5 + 0.1,
    });
  };

  const handleDisconnect = async () => {
    if (!token) return;
    await disconnect({ sessionToken: token });
    await setToken(null);
    router.replace("/welcome");
  };

  const onItemAction = async (id: Id<"sharedItems">, action: "copy" | "download" | "share" | "save" | "delete", item: SessionItem) => {
    if (action === "delete") {
      if (!token) return;
      await deleteItem({ sessionToken: token, itemId: id });
      return;
    }
    if (action === "save") {
      if (!token) return;
      const res = await saveItem({ sessionToken: token, itemId: id });
      if (res.needsUpgrade) router.push("/upgrade");
      return;
    }
    if (action === "copy") {
      if (item.textContent) await Clipboard.setStringAsync(item.textContent);
      else if (item.fileUrl) await Clipboard.setStringAsync(item.fileUrl);
      Alert.alert("Copied", "Copied to clipboard.");
      return;
    }
    if (action === "download") {
      if (!item.fileUrl) return;
      try {
        const target = (FileSystem.cacheDirectory ?? "") + (item.fileName ?? `relay-${Date.now()}`);
        await FileSystem.downloadAsync(item.fileUrl, target);
        Alert.alert("Saved", "Downloaded to app cache.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Try again.";
        Alert.alert("Download failed", msg);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  if (!loading && !token) {
    return (
      <View style={styles.empty}>
        <Ionicons name="flash-outline" size={36} color={theme.textMuted} />
        <Text style={styles.emptyText}>Not connected</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/connect")}>
          <Text style={styles.primaryBtnText}>Connect now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.dot, { backgroundColor: connected ? theme.accent : theme.textMuted }]} />
          <Text style={styles.title}>Relay</Text>
        </View>
        <Pressable onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl tintColor={theme.accent} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.dot, { backgroundColor: connected ? theme.accent : theme.textMuted }]} />
            <Text style={styles.statusTitle}>
              {connected
                ? `Connected to ${session?.browserName ?? "Browser"} on ${session?.deviceName ?? "computer"}`
                : expired
                  ? "Session ended"
                  : "Waiting for connection"}
            </Text>
          </View>
          <View style={styles.modeRow}>
            <View style={styles.modeBadge}>
              <Ionicons name={session?.isProUser ? "star" : "flash"} size={12} color={theme.accent} />
              <Text style={styles.modeBadgeText}>{session?.isProUser ? "Pro" : "Temporary"}</Text>
            </View>
            <Text style={styles.modeNotice}>
              {session?.isProUser
                ? "Saved items remain in your storage."
                : "Temporary items are deleted when the session ends."}
            </Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton icon="chatbubble-ellipses" label="Send text" onPress={() => router.push("/send-text")} />
          <ActionButton icon="image" label="Send photo" onPress={pickPhoto} />
          <ActionButton icon="videocam" label="Send video" onPress={pickVideo} />
          <ActionButton icon="document" label="Send file" onPress={pickFile} />
          <ActionButton icon="link" label="Send link" onPress={sendClipboardText} />
          <ActionButton icon="copy" label="Send clipboard" onPress={sendClipboardText} />
        </View>

        {uploading && (
          <View style={styles.uploadingPill}>
            <Ionicons name="cloud-upload-outline" size={14} color={theme.accent} />
            <Text style={styles.uploadingText}>Uploading…</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Session items</Text>
          <Pressable onPress={() => router.push("/inbox")}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {items && items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="swap-vertical" size={28} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nothing here yet</Text>
            <Text style={styles.emptyHint}>Send something from your phone or paste content into the website.</Text>
          </View>
        ) : (
          (items ?? []).slice(0, 8).map((it) => (
            <ItemCard key={it._id} item={it} onAction={(a) => onItemAction(it._id, a, it)} />
          ))
        )}

        {connected && (
          <Pressable style={styles.disconnectBtn} onPress={handleDisconnect}>
            <Ionicons name="close-circle-outline" size={16} color={theme.danger} />
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function ItemCard({ item, onAction }: { item: SessionItem; onAction: (a: "copy" | "download" | "save" | "delete") => void }) {
  const isText = item.itemType === "text" || item.itemType === "link";
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHead}>
        <View style={styles.itemIcon}>
          <Ionicons
            name={
              item.itemType === "image"
                ? "image-outline"
                : item.itemType === "video"
                  ? "videocam-outline"
                  : item.itemType === "audio"
                    ? "musical-notes-outline"
                    : item.itemType === "link"
                      ? "link-outline"
                      : item.itemType === "text"
                        ? "document-text-outline"
                        : "document-outline"
            }
            size={16}
            color={theme.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.fileName ?? (isText ? (item.textContent ?? "").slice(0, 40) : item.itemType)}
          </Text>
          <Text style={styles.itemMeta}>
            from {item.senderDevice} · {formatRelativeTime(item._creationTime)}
            {item.fileSize ? ` · ${formatBytes(item.fileSize)}` : ""}
          </Text>
        </View>
        {item.isSaved ? (
          <View style={styles.savedBadge}>
            <Ionicons name="star" size={10} color={theme.accent} />
          </View>
        ) : null}
      </View>

      {item.itemType === "image" && item.fileUrl ? (
        <Image source={{ uri: item.fileUrl }} style={styles.itemImage} resizeMode="cover" />
      ) : null}
      {isText ? (
        <Text numberOfLines={4} style={[styles.itemText, item.itemType === "link" && { color: theme.accent }]}>
          {item.textContent}
        </Text>
      ) : null}

      <View style={styles.itemActions}>
        <ItemAction icon="copy-outline" label="Copy" onPress={() => onAction("copy")} />
        {item.fileUrl ? <ItemAction icon="download-outline" label="Save" onPress={() => onAction("download")} /> : null}
        <ItemAction icon={item.isSaved ? "star" : "star-outline"} label={item.isSaved ? "Saved" : "Keep"} onPress={() => onAction("save")} />
        <ItemAction icon="trash-outline" label="Delete" onPress={() => onAction("delete")} danger />
      </View>
    </View>
  );
}

function ItemAction({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={[styles.itemActionBtn, danger && { backgroundColor: "rgba(255,94,108,0.08)", borderColor: "rgba(255,94,108,0.25)" }]} onPress={onPress}>
      <Ionicons name={icon} size={13} color={danger ? theme.danger : theme.textSecondary} />
      <Text style={[styles.itemActionText, danger && { color: theme.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { color: theme.text, fontSize: 16, fontWeight: "600" },
  emptyHint: { color: theme.textSecondary, fontSize: 13, textAlign: "center" },
  primaryBtn: { backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 14, fontWeight: "700" },
  statusCard: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 16, gap: 12 },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusTitle: { color: theme.text, fontSize: 14, fontWeight: "600", flex: 1 },
  modeRow: { gap: 6 },
  modeBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder },
  modeBadgeText: { color: theme.accent, fontSize: 10, fontWeight: "700", letterSpacing: 0.4, fontFamily: theme.mono, textTransform: "uppercase" },
  modeNotice: { color: theme.textMuted, fontSize: 11 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flexBasis: "31%", flexGrow: 1, alignItems: "center", padding: 14, gap: 6, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: theme.text, fontSize: 11, fontWeight: "500" },
  uploadingPill: { flexDirection: "row", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.accentSoft, borderRadius: 20, borderWidth: 1, borderColor: theme.accentBorder },
  uploadingText: { color: theme.accent, fontSize: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "700" },
  sectionLink: { color: theme.accent, fontSize: 12, fontWeight: "500" },
  emptyState: { padding: 24, alignItems: "center", gap: 6, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border },
  itemCard: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, gap: 10 },
  itemHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  itemIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder, alignItems: "center", justifyContent: "center" },
  itemTitle: { color: theme.text, fontSize: 13, fontWeight: "600" },
  itemMeta: { color: theme.textMuted, fontSize: 11 },
  itemImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: 10 },
  itemText: { color: theme.text, fontSize: 13, lineHeight: 19 },
  savedBadge: { width: 22, height: 22, borderRadius: 6, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder, alignItems: "center", justifyContent: "center" },
  itemActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.cardElevated, borderWidth: 1, borderColor: theme.border },
  itemActionText: { color: theme.textSecondary, fontSize: 11, fontWeight: "500" },
  disconnectBtn: { flexDirection: "row", gap: 6, alignSelf: "center", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,94,108,0.08)", borderWidth: 1, borderColor: "rgba(255,94,108,0.25)" },
  disconnectText: { color: theme.danger, fontSize: 13, fontWeight: "600" },
});
