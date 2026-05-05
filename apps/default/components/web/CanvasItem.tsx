import React, { useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Image,
    Platform,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, radii, formatBytes, formatRelativeTime } from "@/lib/theme";
import { api } from "@/convex/_generated/api";
import type { useQuery } from "convex/react";

type ItemDoc = NonNullable<
    ReturnType<typeof useQuery<typeof api.items.listSessionItems>>
>[number];

interface Props {
    item: ItemDoc;
    index: number;
    canvasW: number;
    canvasH: number;
    onSelect: () => void;
    onDelete: () => void;
    onSave: () => void;
    onMove: (x: number, y: number) => void;
}

function iconForType(t: ItemDoc["itemType"]): React.ComponentProps<typeof Ionicons>["name"] {
    switch (t) {
        case "text":
            return "document-text-outline";
        case "link":
            return "link-outline";
        case "image":
            return "image-outline";
        case "video":
            return "videocam-outline";
        case "audio":
            return "musical-notes-outline";
        case "pdf":
            return "document-outline";
        case "document":
            return "document-text-outline";
        default:
            return "folder-outline";
    }
}

export function CanvasItem({
    item,
    index,
    canvasW,
    canvasH,
    onSelect,
    onDelete,
    onSave,
    onMove,
}: Props) {
    const cardW = item.itemType === "image" || item.itemType === "video" ? 220 : 240;
    const cardH =
        item.itemType === "image" || item.itemType === "video"
            ? 200
            : item.itemType === "text"
              ? 160
              : 140;

    // Default position from server, fallback to gridded layout
    const defaultX = item.canvasX ?? ((index * 0.18 + 0.08) % 0.7);
    const defaultY = item.canvasY ?? (Math.floor(index / 4) * 0.25 + 0.1);

    const left = Math.max(8, Math.min(canvasW - cardW - 8, defaultX * canvasW));
    const top = Math.max(8, Math.min(canvasH - cardH - 8, defaultY * canvasH));

    const fade = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(fade, {
            toValue: 1,
            useNativeDriver: true,
            damping: 14,
        }).start();
    }, [fade]);

    // Web drag
    const ref = useRef<View>(null);
    useEffect(() => {
        if (Platform.OS !== "web") return;
        const node = (ref.current as unknown as HTMLElement | null) ?? null;
        if (!node) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;
        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (
                target &&
                (target.tagName === "BUTTON" ||
                    target.closest("button") ||
                    target.closest("[data-noclick]"))
            ) {
                return;
            }
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            baseLeft = parseFloat((node.style.left || `${left}px`).replace("px", ""));
            baseTop = parseFloat((node.style.top || `${top}px`).replace("px", ""));
            e.preventDefault();
            e.stopPropagation();
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            const nx = baseLeft + (e.clientX - startX);
            const ny = baseTop + (e.clientY - startY);
            node.style.left = `${nx}px`;
            node.style.top = `${ny}px`;
        };
        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            const finalLeft = parseFloat(node.style.left.replace("px", ""));
            const finalTop = parseFloat(node.style.top.replace("px", ""));
            if (canvasW > 0 && canvasH > 0) {
                onMove(finalLeft / canvasW, finalTop / canvasH);
            }
        };
        node.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            node.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [canvasW, canvasH, left, top, onMove]);

    return (
        <Animated.View
            ref={ref as React.Ref<React.ComponentRef<typeof Animated.View>>}
            style={[
                styles.card,
                {
                    left,
                    top,
                    width: cardW,
                    minHeight: cardH,
                    opacity: fade,
                    transform: [
                        {
                            scale: fade.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.9, 1],
                            }),
                        },
                    ],
                },
            ]}
        >
            <Pressable onPress={onSelect} style={styles.previewArea}>
                {item.itemType === "image" && item.fileUrl ? (
                    <Image
                        source={{ uri: item.fileUrl }}
                        style={styles.preview}
                        resizeMode="cover"
                    />
                ) : item.itemType === "video" && item.fileUrl ? (
                    <View style={[styles.preview, styles.videoPreview]}>
                        {Platform.OS === "web" ? (
                            <video
                                src={item.fileUrl}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        ) : null}
                        <View style={styles.playOverlay}>
                            <Ionicons name="play" size={20} color="#fff" />
                        </View>
                    </View>
                ) : item.itemType === "text" || item.itemType === "link" ? (
                    <View style={styles.textPreview}>
                        <Ionicons
                            name={iconForType(item.itemType)}
                            size={14}
                            color={theme.accent}
                        />
                        <Text
                            numberOfLines={4}
                            style={[
                                styles.textBody,
                                item.itemType === "link" && {
                                    color: theme.accent,
                                    textDecorationLine: "underline",
                                },
                            ]}
                        >
                            {item.textContent ?? ""}
                        </Text>
                    </View>
                ) : item.itemType === "audio" ? (
                    <View style={styles.audioPreview}>
                        <Ionicons
                            name="musical-notes"
                            size={28}
                            color={theme.accent}
                        />
                        <View style={styles.waveform}>
                            {Array.from({ length: 24 }).map((_, i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: 2,
                                        height: 4 + ((i * 7) % 18),
                                        backgroundColor: theme.accent,
                                        opacity: 0.7,
                                        borderRadius: 1,
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.filePreview}>
                        <View style={styles.fileBadge}>
                            <Ionicons
                                name={iconForType(item.itemType)}
                                size={28}
                                color={theme.accent}
                            />
                        </View>
                    </View>
                )}
            </Pressable>
            <View style={styles.meta}>
                <Text numberOfLines={1} style={styles.title}>
                    {item.fileName ??
                        (item.itemType === "text" ? "Text snippet" : item.itemType)}
                </Text>
                <View style={styles.metaRow}>
                    <View style={styles.senderChip}>
                        <Ionicons
                            name={
                                item.senderDevice === "phone"
                                    ? "phone-portrait-outline"
                                    : "desktop-outline"
                            }
                            size={10}
                            color={theme.textSecondary}
                        />
                        <Text style={styles.metaSmall}>
                            {item.senderDevice}
                        </Text>
                    </View>
                    <Text style={styles.metaSmall}>
                        {formatRelativeTime(item._creationTime)}
                    </Text>
                    {item.fileSize ? (
                        <Text style={styles.metaSmall}>
                            {formatBytes(item.fileSize)}
                        </Text>
                    ) : null}
                    <View
                        style={[
                            styles.modeChip,
                            item.isSaved && {
                                borderColor: theme.accentBorder,
                                backgroundColor: theme.accentSoft,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.modeChipText,
                                item.isSaved && { color: theme.accent },
                            ]}
                        >
                            {item.isSaved ? "saved" : "temp"}
                        </Text>
                    </View>
                </View>
                <View style={styles.actions} {...({} as object)}>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={async () => {
                            if (item.textContent && Platform.OS === "web") {
                                await navigator.clipboard.writeText(item.textContent);
                            } else if (item.fileUrl && Platform.OS === "web") {
                                await navigator.clipboard.writeText(item.fileUrl);
                            }
                        }}
                    >
                        <Ionicons
                            name="copy-outline"
                            size={12}
                            color={theme.textSecondary}
                        />
                    </Pressable>
                    {item.fileUrl && Platform.OS === "web" ? (
                        <Pressable
                            style={styles.actionBtn}
                            onPress={() => {
                                if (typeof window === "undefined") return;
                                const a = window.document.createElement("a");
                                a.href = item.fileUrl!;
                                a.download = item.fileName ?? "download";
                                window.document.body.appendChild(a);
                                a.click();
                                a.remove();
                            }}
                        >
                            <Ionicons
                                name="download-outline"
                                size={12}
                                color={theme.textSecondary}
                            />
                        </Pressable>
                    ) : null}
                    <Pressable style={styles.actionBtn} onPress={onSave}>
                        <Ionicons
                            name={item.isSaved ? "star" : "star-outline"}
                            size={12}
                            color={item.isSaved ? theme.accent : theme.textSecondary}
                        />
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={onDelete}>
                        <Ionicons
                            name="trash-outline"
                            size={12}
                            color={theme.danger}
                        />
                    </Pressable>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: "absolute",
        backgroundColor: theme.card,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
        ...(Platform.OS === "web" ? ({ cursor: "grab" } as unknown as object) : {}),
    },
    previewArea: { width: "100%", height: 110, backgroundColor: theme.cardElevated },
    preview: { width: "100%", height: "100%" },
    videoPreview: {
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
    },
    playOverlay: {
        position: "absolute",
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,92,168,0.85)",
        alignItems: "center",
        justifyContent: "center",
    },
    textPreview: {
        flex: 1,
        padding: 12,
        gap: 8,
        backgroundColor: theme.card,
    },
    textBody: { color: theme.text, fontSize: 12, lineHeight: 18 },
    audioPreview: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 14,
        backgroundColor: theme.card,
    },
    waveform: {
        flex: 1,
        flexDirection: "row",
        gap: 2,
        alignItems: "center",
        height: 30,
    },
    filePreview: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: theme.card,
    },
    fileBadge: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    meta: { padding: 10, gap: 6, borderTopWidth: 1, borderTopColor: theme.border },
    title: { color: theme.text, fontSize: 13, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    senderChip: {
        flexDirection: "row",
        gap: 3,
        alignItems: "center",
    },
    metaSmall: {
        color: theme.textMuted,
        fontSize: 10,
        fontFamily: theme.mono,
    },
    modeChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
    },
    modeChipText: {
        color: theme.textMuted,
        fontSize: 9,
        fontFamily: theme.mono,
        letterSpacing: 0.5,
    },
    actions: { flexDirection: "row", gap: 4, marginTop: 4 },
    actionBtn: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        justifyContent: "center",
    },
});
