import React, { memo, useEffect, useRef } from "react";
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
    isSelected: boolean;
    selectedItemIds: ItemDoc["_id"][];
    onSelectItem: (id: ItemDoc["_id"]) => void;
    onActivateSelection: (id: ItemDoc["_id"]) => void;
    onDeleteItem: (id: ItemDoc["_id"]) => void;
    onSaveItem: (id: ItemDoc["_id"]) => void;
    clampDragDelta: (
        ids: ItemDoc["_id"][],
        deltaX: number,
        deltaY: number
    ) => { x: number; y: number };
    onCommitDrag: (ids: ItemDoc["_id"][], deltaX: number, deltaY: number) => void;
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

function CanvasItemComponent({
    item,
    index,
    canvasW,
    canvasH,
    isSelected,
    selectedItemIds,
    onSelectItem,
    onActivateSelection,
    onDeleteItem,
    onSaveItem,
    clampDragDelta,
    onCommitDrag,
}: Props) {
    const cardW = item.itemType === "image" || item.itemType === "video" ? 220 : 240;
    const cardH =
        item.itemType === "image" || item.itemType === "video"
            ? 200
            : item.itemType === "text"
              ? 160
              : 140;
    const suppressSelectUntilRef = useRef(0);
    const isSelectedRef = useRef(isSelected);
    const selectedItemIdsRef = useRef(selectedItemIds);

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

    useEffect(() => {
        isSelectedRef.current = isSelected;
        selectedItemIdsRef.current = selectedItemIds;
    }, [isSelected, selectedItemIds]);

    const ref = useRef<View>(null);
    const actionsRef = useRef<View>(null);
    useEffect(() => {
        if (Platform.OS !== "web") return;
        const node = (ref.current as unknown as HTMLElement | null) ?? null;
        const actionsNode = (actionsRef.current as unknown as HTMLElement | null) ?? null;
        if (!node) return;
        const body = document.body;

        Array.from(actionsNode?.children ?? []).forEach((child) => {
            if (child instanceof HTMLElement) {
                child.dataset.canvasAction = "true";
            }
        });

        node.dataset.canvasItemRoot = "true";
        node.dataset.itemId = item._id;

        let dragging = false;
        let didDrag = false;
        let startX = 0;
        let startY = 0;
        let currentDeltaX = 0;
        let currentDeltaY = 0;
        let activeDragIds: ItemDoc["_id"][] = [];
        let previewNodes: HTMLElement[] = [];
        let previewFrame: number | null = null;
        let previousBodyUserSelect = "";
        let previousBodyWebkitUserSelect = "";

        const clearPreview = () => {
            previewNodes.forEach((previewNode) => {
                previewNode.style.translate = "0px 0px";
                previewNode.style.zIndex = "";
                previewNode.style.willChange = "";
            });
        };

        const lockSelection = () => {
            previousBodyUserSelect = body.style.userSelect;
            previousBodyWebkitUserSelect = body.style.webkitUserSelect;
            body.style.userSelect = "none";
            body.style.webkitUserSelect = "none";
        };

        const unlockSelection = () => {
            body.style.userSelect = previousBodyUserSelect;
            body.style.webkitUserSelect = previousBodyWebkitUserSelect;
        };

        const onSelectStart = (event: Event) => {
            event.preventDefault();
        };

        const schedulePreview = () => {
            if (previewFrame !== null || typeof requestAnimationFrame !== "function") {
                previewNodes.forEach((previewNode) => {
                    previewNode.style.translate = `${currentDeltaX}px ${currentDeltaY}px`;
                });
                return;
            }
            previewFrame = requestAnimationFrame(() => {
                previewFrame = null;
                previewNodes.forEach((previewNode) => {
                    previewNode.style.translate = `${currentDeltaX}px ${currentDeltaY}px`;
                });
            });
        };

        const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-canvas-action='true']")) {
                return;
            }

            dragging = true;
            didDrag = false;
            startX = event.clientX;
            startY = event.clientY;
            currentDeltaX = 0;
            currentDeltaY = 0;
            const currentIsSelected = isSelectedRef.current;
            const currentSelectedItemIds = selectedItemIdsRef.current;
            activeDragIds =
                currentIsSelected && currentSelectedItemIds.length > 0
                    ? currentSelectedItemIds
                    : [item._id];
            previewNodes = activeDragIds
                .map((id) => document.querySelector(`[data-item-id='${id}']`))
                .filter((previewNode): previewNode is HTMLElement =>
                    previewNode instanceof HTMLElement
                );
            previewNodes.forEach((previewNode) => {
                previewNode.style.willChange = "transform";
                previewNode.style.zIndex = "20";
            });
            if (!currentIsSelected) onActivateSelection(item._id);
            lockSelection();
            node.style.cursor = "grabbing";
            event.preventDefault();
            event.stopPropagation();
        };

        const onMouseMove = (event: MouseEvent) => {
            if (!dragging) return;
            const rawDeltaX = event.clientX - startX;
            const rawDeltaY = event.clientY - startY;
            const nextDelta = clampDragDelta(activeDragIds, rawDeltaX, rawDeltaY);
            currentDeltaX = nextDelta.x;
            currentDeltaY = nextDelta.y;
            if (!didDrag && currentDeltaX === 0 && currentDeltaY === 0) return;
            didDrag = true;
            schedulePreview();
            event.preventDefault();
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            node.style.cursor = "grab";
            if (previewFrame !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(previewFrame);
                previewFrame = null;
            }
            unlockSelection();
            if (!didDrag) {
                clearPreview();
                return;
            }
            suppressSelectUntilRef.current = Date.now() + 250;
            onCommitDrag(activeDragIds, currentDeltaX, currentDeltaY);
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => {
                    clearPreview();
                });
                return;
            }
            clearPreview();
        };

        node.addEventListener("selectstart", onSelectStart);
        node.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            if (previewFrame !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(previewFrame);
            }
            clearPreview();
            unlockSelection();
            node.removeEventListener("selectstart", onSelectStart);
            node.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [clampDragDelta, item._id, onActivateSelection, onCommitDrag]);

    return (
        <Animated.View
            ref={ref as React.Ref<React.ComponentRef<typeof Animated.View>>}
            style={[
                styles.card,
                isSelected && styles.cardSelected,
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
            <Pressable
                onPress={() => {
                    if (Date.now() < suppressSelectUntilRef.current) return;
                    onSelectItem(item._id);
                }}
                style={styles.previewArea}
            >
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
                <View style={styles.actions} ref={actionsRef}>
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
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => onSaveItem(item._id)}
                    >
                        <Ionicons
                            name={item.isSaved ? "star" : "star-outline"}
                            size={12}
                            color={item.isSaved ? theme.accent : theme.textSecondary}
                        />
                    </Pressable>
                    <Pressable
                        style={styles.actionBtn}
                        onPress={() => onDeleteItem(item._id)}
                    >
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

export const CanvasItem = memo(CanvasItemComponent, (previous, next) => {
    return (
        previous.item === next.item &&
        previous.index === next.index &&
        previous.canvasW === next.canvasW &&
        previous.canvasH === next.canvasH &&
        previous.isSelected === next.isSelected &&
        previous.selectedItemIds === next.selectedItemIds &&
        previous.clampDragDelta === next.clampDragDelta &&
        previous.onSelectItem === next.onSelectItem &&
        previous.onActivateSelection === next.onActivateSelection &&
        previous.onDeleteItem === next.onDeleteItem &&
        previous.onSaveItem === next.onSaveItem &&
        previous.onCommitDrag === next.onCommitDrag
    );
});

const styles = StyleSheet.create({
    card: {
        position: "absolute",
        backgroundColor: theme.card,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
        ...(Platform.OS === "web"
            ? ({
                  cursor: "grab",
                  willChange: "transform",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
              } as unknown as object)
            : {}),
    },
    cardSelected: {
        borderColor: theme.accentBorder,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.35), 0 12px 26px rgba(0,0,0,0.35)",
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
