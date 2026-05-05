import React from "react";
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    ScrollView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, radii, formatBytes, formatRelativeTime } from "@/lib/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { useQuery } from "convex/react";

type ItemDoc = NonNullable<
    ReturnType<typeof useQuery<typeof api.items.listSessionItems>>
>[number];

interface Props {
    visible: boolean;
    item: ItemDoc | null;
    onClose: () => void;
    onDelete: (id: Id<"sharedItems">) => void;
    onSave: (id: Id<"sharedItems">) => void;
    isPro: boolean;
}

export function ItemDetailModal({
    visible,
    item,
    onClose,
    onDelete,
    onSave,
    isPro,
}: Props) {
    if (!item) return null;
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title} numberOfLines={1}>
                                {item.fileName ?? item.itemType}
                            </Text>
                            <Text style={styles.subtitle}>
                                from {item.senderDevice} ·{" "}
                                {formatRelativeTime(item._creationTime)}{" "}
                                {item.fileSize ? `· ${formatBytes(item.fileSize)}` : ""}
                            </Text>
                        </View>
                        <Pressable style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={18} color={theme.text} />
                        </Pressable>
                    </View>
                    <ScrollView style={styles.body} contentContainerStyle={{ padding: 16, gap: 14 }}>
                        {item.itemType === "image" && item.fileUrl ? (
                            <Image
                                source={{ uri: item.fileUrl }}
                                style={styles.imageView}
                                resizeMode="contain"
                            />
                        ) : item.itemType === "video" && item.fileUrl ? (
                            Platform.OS === "web" ? (
                                // eslint-disable-next-line jsx-a11y/media-has-caption
                                <video
                                    src={item.fileUrl}
                                    controls
                                    style={{
                                        width: "100%",
                                        maxHeight: 420,
                                        borderRadius: 12,
                                        background: "#000",
                                    }}
                                />
                            ) : null
                        ) : item.itemType === "audio" && item.fileUrl ? (
                            Platform.OS === "web" ? (
                                // eslint-disable-next-line jsx-a11y/media-has-caption
                                <audio src={item.fileUrl} controls style={{ width: "100%" }} />
                            ) : null
                        ) : item.itemType === "text" || item.itemType === "link" ? (
                            <View style={styles.textBlock}>
                                <Text
                                    selectable
                                    style={[
                                        styles.textBody,
                                        item.itemType === "link" && {
                                            color: theme.accent,
                                        },
                                    ]}
                                >
                                    {item.textContent}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.fileBlock}>
                                <Ionicons
                                    name="document-outline"
                                    size={48}
                                    color={theme.accent}
                                />
                                <Text style={styles.fileName}>{item.fileName}</Text>
                                <Text style={styles.fileSize}>
                                    {formatBytes(item.fileSize)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.row}>
                            {item.textContent && Platform.OS === "web" ? (
                                <ActionBtn
                                    icon="copy-outline"
                                    label="Copy"
                                    onPress={async () => {
                                        await navigator.clipboard.writeText(
                                            item.textContent ?? ""
                                        );
                                    }}
                                />
                            ) : null}
                            {item.fileUrl && Platform.OS === "web" ? (
                                <ActionBtn
                                    icon="download-outline"
                                    label="Download"
                                    onPress={() => {
                                        const a = window.document.createElement("a");
                                        a.href = item.fileUrl!;
                                        a.download = item.fileName ?? "download";
                                        window.document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                    }}
                                />
                            ) : null}
                            <ActionBtn
                                icon={item.isSaved ? "star" : "star-outline"}
                                label={item.isSaved ? "Saved" : isPro ? "Save" : "Save (Pro)"}
                                onPress={() => onSave(item._id)}
                                primary={item.isSaved}
                            />
                            <ActionBtn
                                icon="trash-outline"
                                label="Delete"
                                onPress={() => {
                                    onDelete(item._id);
                                    onClose();
                                }}
                                danger
                            />
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function ActionBtn({
    icon,
    label,
    onPress,
    primary,
    danger,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
    primary?: boolean;
    danger?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.actionBtn,
                primary && {
                    backgroundColor: theme.accentSoft,
                    borderColor: theme.accentBorder,
                },
                danger && {
                    backgroundColor: "rgba(255,94,108,0.08)",
                    borderColor: "rgba(255,94,108,0.3)",
                },
            ]}
        >
            <Ionicons
                name={icon}
                size={14}
                color={
                    primary
                        ? theme.accent
                        : danger
                          ? theme.danger
                          : theme.textSecondary
                }
            />
            <Text
                style={[
                    styles.actionLabel,
                    primary && { color: theme.accent },
                    danger && { color: theme.danger },
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    sheet: {
        backgroundColor: theme.panel,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: theme.border,
        width: "100%",
        maxWidth: 640,
        maxHeight: "90%",
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        padding: 16,
        gap: 10,
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    title: { color: theme.text, fontSize: 16, fontWeight: "600" },
    subtitle: { color: theme.textMuted, fontSize: 12 },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    body: { maxHeight: "100%" },
    imageView: {
        width: "100%",
        height: 320,
        borderRadius: radii.lg,
        backgroundColor: theme.card,
    },
    textBlock: {
        backgroundColor: theme.card,
        borderRadius: radii.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.border,
    },
    textBody: { color: theme.text, fontSize: 14, lineHeight: 22 },
    fileBlock: {
        backgroundColor: theme.card,
        borderRadius: radii.lg,
        padding: 32,
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    fileName: { color: theme.text, fontSize: 14, fontWeight: "600" },
    fileSize: { color: theme.textMuted, fontSize: 12, fontFamily: theme.mono },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.pill,
    },
    actionLabel: { color: theme.textSecondary, fontSize: 13 },
});
