import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image, TextInput, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { theme, formatBytes, formatRelativeTime } from "@/lib/theme";
import { useSessionToken } from "@/lib/session-token";
import * as Clipboard from "expo-clipboard";

type SessionItem = NonNullable<ReturnType<typeof useQuery<typeof api.items.listSessionItems>>>[number];

type Filter = "all" | "text" | "image" | "video" | "audio" | "file" | "link";

export default function InboxScreen() {
  const router = useRouter();
  const { token } = useSessionToken();
  const items = useQuery(api.items.listSessionItems, token ? { sessionToken: token } : "skip");
  const deleteItem = useMutation(api.items.deleteItem);
  const saveItem = useMutation(api.items.saveItem);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const base = items ?? [];
    return base.filter((i) => {
      if (filter === "all") {
        // ok
      } else if (filter === "file") {
        if (!["file", "document", "pdf"].includes(i.itemType)) return false;
      } else if (i.itemType !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (i.fileName?.toLowerCase().includes(q) ?? false) ||
        (i.textContent?.toLowerCase().includes(q) ?? false) ||
        i.itemType.includes(q)
      );
    });
  }, [items, filter, search]);

  const handleSave = async (id: Id<"sharedItems">) => {
    if (!token) return;
    const r = await saveItem({ sessionToken: token, itemId: id });
    if (r.needsUpgrade) router.push("/upgrade");
  };

  const handleCopy = async (item: SessionItem) => {
    if (item.textContent) await Clipboard.setStringAsync(item.textContent);
    else if (item.fileUrl) await Clipboard.setStringAsync(item.fileUrl);
    Alert.alert("Copied", "Copied to clipboard.");
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Inbox</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={14} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search session items"
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(
          [
            { id: "all", label: "All" },
            { id: "text", label: "Text" },
            { id: "link", label: "Links" },
            { id: "image", label: "Images" },
            { id: "video", label: "Videos" },
            { id: "audio", label: "Audio" },
            { id: "file", label: "Files" },
          ] as { id: Filter; label: string }[]
        ).map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={28} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nothing in this filter</Text>
          </View>
        ) : (
          filtered.map((it) => (
            <View key={it._id} style={styles.itemCard}>
              <View style={styles.itemHead}>
                <View style={styles.itemIcon}>
                  <Ionicons
                    name={
                      it.itemType === "image"
                        ? "image-outline"
                        : it.itemType === "video"
                          ? "videocam-outline"
                          : it.itemType === "audio"
                            ? "musical-notes-outline"
                            : it.itemType === "link"
                              ? "link-outline"
                              : it.itemType === "text"
                                ? "document-text-outline"
                                : "document-outline"
                    }
                    size={16}
                    color={theme.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {it.fileName ?? (it.textContent ? it.textContent.slice(0, 40) : it.itemType)}
                  </Text>
                  <Text style={styles.itemMeta}>
                    from {it.senderDevice} · {formatRelativeTime(it._creationTime)}
                    {it.fileSize ? ` · ${formatBytes(it.fileSize)}` : ""}
                  </Text>
                </View>
              </View>
              {it.itemType === "image" && it.fileUrl ? (
                <Image source={{ uri: it.fileUrl }} style={styles.itemImage} resizeMode="cover" />
              ) : null}
              {(it.itemType === "text" || it.itemType === "link") && it.textContent ? (
                <Text numberOfLines={3} style={[styles.itemText, it.itemType === "link" && { color: theme.accent }]}>
                  {it.textContent}
                </Text>
              ) : null}
              <View style={styles.itemActions}>
                <Action icon="copy-outline" label="Copy" onPress={() => handleCopy(it)} />
                <Action icon={it.isSaved ? "star" : "star-outline"} label={it.isSaved ? "Saved" : "Keep"} onPress={() => handleSave(it._id)} />
                <Action icon="trash-outline" label="Delete" danger onPress={() => token && deleteItem({ sessionToken: token, itemId: it._id })} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      style={[styles.actionBtn, danger && { backgroundColor: "rgba(255,94,108,0.08)", borderColor: "rgba(255,94,108,0.25)" }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={13} color={danger ? theme.danger : theme.textSecondary} />
      <Text style={[styles.actionLabel, danger && { color: theme.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, color: theme.text, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  filterRow: { gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder },
  chipText: { color: theme.textSecondary, fontSize: 12, fontWeight: "500" },
  chipTextActive: { color: theme.accent, fontWeight: "700" },
  emptyState: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { color: theme.textSecondary, fontSize: 13 },
  itemCard: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, gap: 10 },
  itemHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  itemIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentBorder, alignItems: "center", justifyContent: "center" },
  itemTitle: { color: theme.text, fontSize: 13, fontWeight: "600" },
  itemMeta: { color: theme.textMuted, fontSize: 11 },
  itemImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: 10 },
  itemText: { color: theme.text, fontSize: 13, lineHeight: 19 },
  itemActions: { flexDirection: "row", gap: 6 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.cardElevated, borderWidth: 1, borderColor: theme.border },
  actionLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: "500" },
});
