import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { theme, formatBytes, formatRelativeTime } from "@/lib/theme";
import { GridBackdrop } from "@/components/GridBackdrop";
import * as Clipboard from "expo-clipboard";

type Filter = "all" | "text" | "image" | "video" | "audio" | "file" | "link";

export default function StorageScreen() {
  const router = useRouter();
  const items = useQuery(api.items.listSavedItems, {});
  const me = useQuery(api.users.getMe);
  const deleteSavedItem = useMutation(api.items.deleteSavedItem);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const base = items ?? [];
    return base.filter((i) => {
      if (filter !== "all") {
        if (filter === "file" ? !["file", "document", "pdf"].includes(i.itemType) : i.itemType !== filter) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (i.fileName?.toLowerCase().includes(q) ?? false) || (i.textContent?.toLowerCase().includes(q) ?? false);
    });
  }, [items, filter, search]);

  const totalBytes = useMemo(() => (items ?? []).reduce((acc, i) => acc + (i.fileSize ?? 0), 0), [items]);
  const QUOTA = 5 * 1024 * 1024 * 1024;

  if (!me) return null;

  const isPro = me.isPro;

  if (!isPro) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <GridBackdrop />
        <Ionicons name="lock-closed-outline" size={32} color={theme.textMuted} />
        <Text style={[styles.title, { marginTop: 12 }]}>Saved storage is Pro</Text>
        <Text style={[styles.subtitle, { textAlign: "center", marginVertical: 8 }]}>Upgrade to keep files and history beyond your session.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/upgrade")}>
          <Text style={styles.primaryBtnText}>Upgrade for €2.50/mo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GridBackdrop />
      <View style={styles.topRow}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Saved storage</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={14} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search saved items"
          placeholderTextColor={theme.textMuted}
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

      <View style={styles.usageCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.usageLabel}>Storage used</Text>
          <Text style={styles.usageValue}>{formatBytes(totalBytes)}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.min(100, (totalBytes / QUOTA) * 100)}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="server-outline" size={28} color={theme.textMuted} />
            <Text style={styles.subtitle}>No saved items yet</Text>
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
                    {formatRelativeTime(it._creationTime)}
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
                <Pressable
                  style={styles.actionBtn}
                  onPress={async () => {
                    if (it.textContent) await Clipboard.setStringAsync(it.textContent);
                    else if (it.fileUrl) await Clipboard.setStringAsync(it.fileUrl);
                    Alert.alert("Copied", "Copied to clipboard.");
                  }}
                >
                  <Ionicons name="copy-outline" size={13} color={theme.textSecondary} />
                  <Text style={styles.actionLabel}>Copy</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "rgba(255,94,108,0.08)", borderColor: "rgba(255,94,108,0.25)" }]}
                  onPress={() => deleteSavedItem({ itemId: it._id as Id<"sharedItems"> })}
                >
                  <Ionicons name="trash-outline" size={13} color={theme.danger} />
                  <Text style={[styles.actionLabel, { color: theme.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  title: { color: theme.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: theme.textSecondary, fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, color: theme.text, fontSize: 13, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  filterRow: { gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder },
  chipText: { color: theme.textSecondary, fontSize: 12, fontWeight: "500" },
  chipTextActive: { color: theme.accent, fontWeight: "700" },
  usageCard: { marginHorizontal: 16, padding: 14, borderRadius: 14, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, gap: 8 },
  usageLabel: { color: theme.textMuted, fontSize: 11, fontFamily: theme.mono, letterSpacing: 1 },
  usageValue: { color: theme.text, fontSize: 16, fontWeight: "700" },
  barTrack: { height: 5, backgroundColor: theme.cardElevated, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: theme.accent },
  emptyState: { padding: 40, alignItems: "center", gap: 10 },
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
  primaryBtn: { backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  primaryBtnText: { color: "#0a0a0d", fontSize: 14, fontWeight: "700" },
});
