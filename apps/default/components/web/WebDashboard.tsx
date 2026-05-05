import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    TextInput,
    Platform,
    useWindowDimensions,
    ActivityIndicator,
} from "react-native";
import { useMutation, useQuery, useConvex } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { theme, radii, isLikelyUrl } from "@/lib/theme";
import { useSessionToken, detectBrowserName, detectDeviceName } from "@/lib/session-token";
import { uploadFileBlob } from "@/lib/upload";
import { QRCodeView } from "@/components/QRCodeView";
import { Ionicons } from "@expo/vector-icons";
import { Id } from "@/convex/_generated/dataModel";
import { CanvasItem } from "./CanvasItem";
import { ItemDetailModal } from "./ItemDetailModal";
import { UpgradeModal } from "./UpgradeModal";
import { useAuthToken } from "@convex-dev/auth/react";

type ItemDoc = NonNullable<ReturnType<typeof useQuery<typeof api.items.listSessionItems>>>[number];

export default function WebDashboard() {
    const { token, setToken, loading: tokenLoading } = useSessionToken();
    const { signOut } = useAuthActions();
    const convex = useConvex();
    const authToken = useAuthToken();
    const isAuthed = !!authToken;
    const me = useQuery(api.users.getMe, isAuthed ? {} : "skip");

    const sessionData = useQuery(
        api.sessions.getSessionByToken,
        token ? { sessionToken: token } : "skip"
    );
    const items = useQuery(
        api.items.listSessionItems,
        token ? { sessionToken: token } : "skip"
    );

    const createSession = useMutation(api.sessions.createBrowserSession);
    const newCode = useMutation(api.sessions.newPairingCode);
    const disconnectSession = useMutation(api.sessions.disconnectSession);
    const sendItem = useMutation(api.items.sendItem);
    const deleteItem = useMutation(api.items.deleteItem);
    const saveItem = useMutation(api.items.saveItem);
    const updateItemPosition = useMutation(api.items.updateItemPosition);
    const heartbeat = useMutation(api.sessions.heartbeat);

    // Bootstrap a session if missing or invalid
    useEffect(() => {
        if (tokenLoading) return;
        if (token && sessionData === null) {
            // server says session does not exist — clear and recreate
            void setToken(null);
            return;
        }
        if (!token) {
            void (async () => {
                const result = await createSession({
                    deviceName: detectDeviceName(),
                    browserName: detectBrowserName(),
                });
                await setToken(result.sessionToken);
            })();
        }
    }, [token, tokenLoading, sessionData, createSession, setToken]);

    // Heartbeat to keep session fresh
    useEffect(() => {
        if (!token) return;
        const id = setInterval(() => {
            heartbeat({ sessionToken: token }).catch(() => {});
        }, 60_000);
        return () => clearInterval(id);
    }, [token, heartbeat]);

    // Cleanup on unload
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = () => {
            if (token) {
                try {
                    const url = (process.env.EXPO_PUBLIC_CONVEX_URL ?? "").replace(
                        /\/$/,
                        ""
                    );
                    const body = JSON.stringify({
                        path: "sessions:disconnectSession",
                        args: { sessionToken: token },
                        format: "json",
                    });
                    if (navigator.sendBeacon && url) {
                        const blob = new Blob([body], { type: "application/json" });
                        navigator.sendBeacon(`${url}/api/mutation`, blob);
                    }
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [token]);

    const status = sessionData?.status ?? "waiting";
    const connected = status === "connected";
    const code = sessionData?.code;
    const qrToken = sessionData?.qrToken;
    const phoneName = sessionData?.phoneDeviceName;
    const isPro = me?.isPro ?? sessionData?.isProUser ?? false;

    // Pairing payload encoded into the QR
    const qrValue = useMemo(() => {
        if (!qrToken) return "";
        return qrToken;
    }, [qrToken]);

    const [textDraft, setTextDraft] = useState("");
    const [selectedItemId, setSelectedItemId] = useState<Id<"sharedItems"> | null>(null);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    const sendText = useCallback(
        async (text: string) => {
            if (!token || !text.trim()) return;
            const trimmed = text.trim();
            await sendItem({
                sessionToken: token,
                senderDevice: "web",
                itemType: isLikelyUrl(trimmed) ? "link" : "text",
                textContent: trimmed,
                canvasX: Math.random() * 0.6 + 0.1,
                canvasY: Math.random() * 0.5 + 0.1,
            });
        },
        [token, sendItem]
    );

    const sendFiles = useCallback(
        async (files: File[]) => {
            if (!token || files.length === 0) return;
            setUploadingCount((c) => c + files.length);
            try {
                for (const file of files) {
                    try {
                        const { storageId } = await uploadFileBlob(convex, file);
                        const mime = file.type || "application/octet-stream";
                        const itemType: ItemDoc["itemType"] = mime.startsWith("image/")
                            ? "image"
                            : mime.startsWith("video/")
                              ? "video"
                              : mime.startsWith("audio/")
                                ? "audio"
                                : mime === "application/pdf"
                                  ? "pdf"
                                  : mime.includes("text") || mime.includes("document") || mime.includes("word")
                                    ? "document"
                                    : "file";
                        await sendItem({
                            sessionToken: token,
                            senderDevice: "web",
                            itemType,
                            storageId,
                            fileName: file.name,
                            fileSize: file.size,
                            mimeType: mime,
                            canvasX: Math.random() * 0.6 + 0.1,
                            canvasY: Math.random() * 0.5 + 0.1,
                        });
                    } catch (e) {
                        console.error("upload failed", e);
                    }
                }
            } finally {
                setUploadingCount((c) => Math.max(0, c - files.length));
            }
        },
        [token, convex, sendItem]
    );

    // Paste handler
    useEffect(() => {
        if (typeof window === "undefined") return;
        const onPaste = async (e: ClipboardEvent) => {
            if (!token) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
            const dt = e.clipboardData;
            if (!dt) return;
            const fileList: File[] = [];
            for (let i = 0; i < dt.items.length; i++) {
                const item = dt.items[i];
                if (item.kind === "file") {
                    const f = item.getAsFile();
                    if (f) fileList.push(f);
                }
            }
            if (fileList.length > 0) {
                e.preventDefault();
                await sendFiles(fileList);
                return;
            }
            const text = dt.getData("text/plain");
            if (text) {
                e.preventDefault();
                await sendText(text);
            }
        };
        window.addEventListener("paste", onPaste as unknown as EventListener);
        return () => window.removeEventListener("paste", onPaste as unknown as EventListener);
    }, [token, sendText, sendFiles]);

    const handleDisconnect = useCallback(async () => {
        if (!token) return;
        await disconnectSession({ sessionToken: token });
    }, [token, disconnectSession]);

    const handleNewCode = useCallback(async () => {
        if (!token) return;
        await newCode({ sessionToken: token });
    }, [token, newCode]);

    const handleCopyCode = useCallback(async () => {
        if (code && typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(code);
        }
    }, [code]);

    const handleSaveItem = useCallback(
        async (id: Id<"sharedItems">) => {
            if (!token) return;
            const result = await saveItem({ sessionToken: token, itemId: id });
            if (result.needsUpgrade) {
                setUpgradeOpen(true);
            }
        },
        [token, saveItem]
    );

    const handleDeleteItem = useCallback(
        async (id: Id<"sharedItems">) => {
            if (!token) return;
            await deleteItem({ sessionToken: token, itemId: id });
            if (selectedItemId === id) setSelectedItemId(null);
        },
        [token, deleteItem, selectedItemId]
    );

    const dimensions = useWindowDimensions();
    const compact = dimensions.width < 1024;

    return (
        <View style={styles.root}>
            {/* Top nav */}
            <View style={styles.topbar}>
                <View style={styles.brandRow}>
                    <View style={styles.logoSquare}>
                        <Ionicons name="flash" size={18} color="#fff" />
                    </View>
                    <Text style={styles.brandText}>Relay</Text>
                    <View style={styles.dot} />
                    <Text style={styles.brandSubtle}>by bloom.diy</Text>
                </View>
                <View style={styles.topActions}>
                    <PillButton
                        icon="clipboard-outline"
                        label="Clipboard"
                        onPress={() => sendText(textDraft)}
                    />
                    <PillButton
                        icon={connected ? "flash" : "link-outline"}
                        label={connected ? "Connected" : "Connect"}
                        active={connected}
                    />
                    <PillButton
                        icon="share-outline"
                        label="Share"
                        primary
                    />
                    {me ? (
                        <Pressable
                            style={styles.avatar}
                            onPress={() => signOut()}
                        >
                            <Text style={styles.avatarText}>
                                {(me.name || me.email || "U").slice(0, 1).toUpperCase()}
                            </Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={[styles.avatar, { backgroundColor: theme.cardElevated }]}
                            onPress={() => setUpgradeOpen(true)}
                        >
                            <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Body */}
            <View style={[styles.body, compact && { flexDirection: "column" }]}>
                {/* Sidebar */}
                <ScrollView
                    style={[styles.sidebar, compact && { width: "100%", maxHeight: 480 }]}
                    contentContainerStyle={{ padding: 18, gap: 14 }}
                >
                    <Text style={styles.sectionLabel}>CONNECTION</Text>
                    <View style={styles.statusRow}>
                        <View
                            style={[
                                styles.pulseDot,
                                connected
                                    ? { backgroundColor: theme.accent }
                                    : { backgroundColor: theme.textMuted },
                            ]}
                        />
                        <Text style={styles.statusText}>
                            {connected
                                ? `Connected to ${phoneName ?? "phone"}`
                                : "Waiting for device\u2026"}
                        </Text>
                    </View>

                    {/* QR card */}
                    <View style={styles.qrCard}>
                        {qrValue ? (
                            <View style={{ position: "relative", alignItems: "center" }}>
                                <QRCodeView value={qrValue} size={196} />
                            </View>
                        ) : (
                            <ActivityIndicator color={theme.accent} />
                        )}
                        <Text style={styles.qrHelper}>Scan with Relay on your phone</Text>
                    </View>

                    {/* Code card */}
                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>Or enter code on your phone</Text>
                        <Text selectable style={styles.codeText}>
                            {code ? `${code.slice(0, 3)} ${code.slice(3)}` : "------"}
                        </Text>
                        <Text style={styles.codeSub}>
                            Enter this in the Relay app
                        </Text>
                        <View style={styles.codeButtonsRow}>
                            <SmallButton
                                icon="copy-outline"
                                label="Copy code"
                                onPress={handleCopyCode}
                            />
                            <SmallButton
                                icon="refresh"
                                label="New code"
                                onPress={handleNewCode}
                            />
                        </View>
                        {connected && (
                            <Pressable
                                style={styles.disconnectBtn}
                                onPress={handleDisconnect}
                            >
                                <Ionicons
                                    name="close-circle-outline"
                                    size={14}
                                    color={theme.danger}
                                />
                                <Text style={styles.disconnectText}>Disconnect</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Promo */}
                    <View style={styles.promoCard}>
                        <View style={styles.promoIcon}>
                            <Ionicons name="phone-portrait-outline" size={16} color={theme.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.promoTitle}>Relay for iOS &amp; Android</Text>
                        </View>
                        <Pressable style={styles.promoCta}>
                            <Text style={styles.promoCtaText}>Get app →</Text>
                        </Pressable>
                    </View>

                    {!isPro && (
                        <Pressable
                            style={styles.upgradeCard}
                            onPress={() => setUpgradeOpen(true)}
                        >
                            <Ionicons name="sparkles" size={16} color={theme.accent} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.upgradeTitle}>Keep your storage</Text>
                                <Text style={styles.upgradeSub}>
                                    €2.50/mo · save files &amp; history
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={theme.accent}
                            />
                        </Pressable>
                    )}
                </ScrollView>

                {/* Canvas */}
                <View style={styles.canvasWrap}>
                    <DropCanvas
                        items={items ?? []}
                        connected={connected}
                        dragOver={dragOver}
                        setDragOver={setDragOver}
                        onDropFiles={sendFiles}
                        onSelect={(id) => setSelectedItemId(id)}
                        onDelete={handleDeleteItem}
                        onSave={handleSaveItem}
                        onUpdatePosition={(id, x, y) =>
                            token &&
                            updateItemPosition({
                                sessionToken: token,
                                itemId: id,
                                x,
                                y,
                            })
                        }
                    />

                    {/* Bottom text input */}
                    <View style={styles.bottomBar}>
                        <View style={styles.textInputCard}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={16}
                                color={theme.textSecondary}
                            />
                            <TextInput
                                style={styles.textInput}
                                placeholder={
                                    connected
                                        ? "Type text to send to your phone…"
                                        : "Type or paste anything (connect a phone to relay it)"
                                }
                                placeholderTextColor={theme.textMuted}
                                value={textDraft}
                                onChangeText={setTextDraft}
                                onSubmitEditing={async () => {
                                    await sendText(textDraft);
                                    setTextDraft("");
                                }}
                                returnKeyType="send"
                            />
                            <Pressable
                                style={[
                                    styles.sendBtn,
                                    !textDraft.trim() && { opacity: 0.4 },
                                ]}
                                disabled={!textDraft.trim()}
                                onPress={async () => {
                                    await sendText(textDraft);
                                    setTextDraft("");
                                }}
                            >
                                <Ionicons name="arrow-up" size={16} color="#fff" />
                                <Text style={styles.sendBtnText}>Send</Text>
                            </Pressable>
                        </View>
                        {uploadingCount > 0 && (
                            <View style={styles.uploadingPill}>
                                <ActivityIndicator color={theme.accent} size="small" />
                                <Text style={styles.uploadingText}>
                                    Uploading {uploadingCount}…
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Right tool rail */}
                {!compact && (
                    <View style={styles.toolRail}>
                        <ToolButton icon="navigate-outline" active />
                        <ToolButton icon="cloud-upload-outline" />
                        <ToolButton icon="text-outline" />
                        <ToolButton icon="clipboard-outline" />
                        <ToolButton icon="image-outline" />
                        <ToolButton icon="star-outline" />
                    </View>
                )}
            </View>

            {/* Detail modal */}
            <ItemDetailModal
                visible={!!selectedItemId}
                onClose={() => setSelectedItemId(null)}
                item={items?.find((i) => i._id === selectedItemId) ?? null}
                onDelete={handleDeleteItem}
                onSave={handleSaveItem}
                isPro={isPro}
            />
            <UpgradeModal
                visible={upgradeOpen}
                onClose={() => setUpgradeOpen(false)}
                isAuthed={isAuthed}
            />
        </View>
    );
}

function PillButton({
    icon,
    label,
    onPress,
    primary,
    active,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress?: () => void;
    primary?: boolean;
    active?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.pillBtn,
                primary && {
                    backgroundColor: theme.accent,
                    borderColor: theme.accentBright,
                },
                active &&
                    !primary && {
                        backgroundColor: theme.accentSoft,
                        borderColor: theme.accentBorder,
                    },
            ]}
        >
            <Ionicons
                name={icon}
                size={14}
                color={primary ? "#fff" : active ? theme.accent : theme.textSecondary}
            />
            <Text
                style={[
                    styles.pillBtnText,
                    primary && { color: "#fff", fontWeight: "600" },
                    active && !primary && { color: theme.accent },
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function SmallButton({
    icon,
    label,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress?: () => void;
}) {
    return (
        <Pressable style={styles.smallBtn} onPress={onPress}>
            <Ionicons name={icon} size={13} color={theme.textSecondary} />
            <Text style={styles.smallBtnText}>{label}</Text>
        </Pressable>
    );
}

function ToolButton({
    icon,
    active,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    active?: boolean;
}) {
    return (
        <Pressable
            style={[
                styles.toolBtn,
                active && {
                    backgroundColor: theme.accentSoft,
                    borderColor: theme.accentBorder,
                },
            ]}
        >
            <Ionicons
                name={icon}
                size={16}
                color={active ? theme.accent : theme.textSecondary}
            />
        </Pressable>
    );
}

function DropCanvas({
    items,
    connected,
    dragOver,
    setDragOver,
    onDropFiles,
    onSelect,
    onDelete,
    onSave,
    onUpdatePosition,
}: {
    items: ItemDoc[];
    connected: boolean;
    dragOver: boolean;
    setDragOver: (b: boolean) => void;
    onDropFiles: (files: File[]) => void;
    onSelect: (id: Id<"sharedItems">) => void;
    onDelete: (id: Id<"sharedItems">) => void;
    onSave: (id: Id<"sharedItems">) => void;
    onUpdatePosition: (id: Id<"sharedItems">, x: number, y: number) => void;
}) {
    const ref = useRef<View>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    // Web-specific drag-and-drop
    useEffect(() => {
        if (Platform.OS !== "web" || typeof window === "undefined") return;
        const node = (ref.current as unknown as HTMLElement | null) ?? null;
        if (!node) return;
        const onDragOver = (e: DragEvent) => {
            e.preventDefault();
            setDragOver(true);
        };
        const onDragLeave = (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);
        };
        const onDrop = (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            if (!e.dataTransfer) return;
            const files: File[] = [];
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                files.push(e.dataTransfer.files[i]);
            }
            if (files.length > 0) onDropFiles(files);
        };
        node.addEventListener("dragover", onDragOver);
        node.addEventListener("dragleave", onDragLeave);
        node.addEventListener("drop", onDrop);
        return () => {
            node.removeEventListener("dragover", onDragOver);
            node.removeEventListener("dragleave", onDragLeave);
            node.removeEventListener("drop", onDrop);
        };
    }, [onDropFiles, setDragOver]);

    return (
        <View
            ref={ref}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize({ w: width, h: height });
            }}
            style={[
                styles.canvas,
                dragOver && {
                    borderColor: theme.accent,
                    backgroundColor: theme.accentSoft,
                },
            ]}
        >
            <View style={styles.dotGrid} pointerEvents="none" />

            {items.length === 0 ? (
                <View style={styles.emptyCenter} pointerEvents="none">
                    <View style={styles.dropIcon}>
                        <Ionicons
                            name="cloud-upload-outline"
                            size={32}
                            color={theme.accent}
                        />
                    </View>
                    <Text style={styles.emptyHeading}>
                        {connected ? "Connected to your phone" : "Drop anything here"}
                    </Text>
                    <Text style={styles.emptySub}>
                        {connected
                            ? "Drop files here or paste anything to send"
                            : "Files, images, videos, audio, text.\nOr connect your phone to relay content between devices instantly."}
                    </Text>
                    <View style={styles.hintRow}>
                        <View style={styles.hintChip}>
                            <Text style={styles.hintKey}>⌘V</Text>
                            <Text style={styles.hintText}>to paste</Text>
                        </View>
                        <View style={styles.hintChip}>
                            <Ionicons
                                name="hand-left-outline"
                                size={12}
                                color={theme.textSecondary}
                            />
                            <Text style={styles.hintText}>drag to drop</Text>
                        </View>
                    </View>
                </View>
            ) : (
                items.map((it, idx) => (
                    <CanvasItem
                        key={it._id}
                        item={it}
                        index={idx}
                        canvasW={size.w}
                        canvasH={size.h}
                        onSelect={() => onSelect(it._id)}
                        onDelete={() => onDelete(it._id)}
                        onSave={() => onSave(it._id)}
                        onMove={(nx, ny) => onUpdatePosition(it._id, nx, ny)}
                    />
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: theme.bg,
        ...(Platform.OS === "web" ? { minHeight: "100vh" as unknown as number } : {}),
    },
    topbar: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.bg,
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    logoSquare: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 18px rgba(255,92,168,0.45)",
    },
    brandText: {
        color: theme.text,
        fontWeight: "700",
        fontSize: 18,
        letterSpacing: 0.2,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.border,
        marginHorizontal: 4,
    },
    brandSubtle: {
        color: theme.textMuted,
        fontSize: 12,
        fontFamily: theme.mono,
    },
    topActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    pillBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radii.pill,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    pillBtnText: { color: theme.textSecondary, fontSize: 13 },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
    },
    avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    body: { flex: 1, flexDirection: "row" },
    sidebar: {
        width: 320,
        borderRightWidth: 1,
        borderRightColor: theme.border,
        backgroundColor: theme.panel,
    },
    sectionLabel: {
        color: theme.textMuted,
        fontSize: 10,
        fontFamily: theme.mono,
        letterSpacing: 1.4,
    },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        boxShadow: "0 0 10px rgba(255,92,168,0.7)",
    },
    statusText: { color: theme.text, fontSize: 14, fontWeight: "500" },
    qrCard: {
        backgroundColor: theme.card,
        padding: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        gap: 10,
    },
    qrCenterBadge: {
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 32,
        height: 32,
        marginTop: -16,
        marginLeft: -16,
        borderRadius: 9,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "#fff",
    },
    qrHelper: {
        color: theme.textMuted,
        fontSize: 11,
        fontFamily: theme.mono,
        letterSpacing: 0.6,
    },
    codeCard: {
        backgroundColor: theme.card,
        padding: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.border,
        gap: 8,
    },
    codeLabel: {
        color: theme.textMuted,
        fontSize: 10,
        letterSpacing: 1.2,
        fontFamily: theme.mono,
    },
    codeText: {
        color: theme.text,
        fontSize: 32,
        fontWeight: "600",
        fontFamily: theme.mono,
        letterSpacing: 6,
    },
    codeSub: { color: theme.textSecondary, fontSize: 12 },
    codeButtonsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    smallBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
    },
    smallBtnText: { color: theme.textSecondary, fontSize: 12 },
    disconnectBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: "rgba(255,94,108,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,94,108,0.25)",
        marginTop: 6,
        alignSelf: "flex-start",
    },
    disconnectText: { color: theme.danger, fontSize: 12, fontWeight: "500" },
    promoCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    promoIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: theme.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: theme.accentBorder,
    },
    promoTitle: { color: theme.text, fontSize: 13, fontWeight: "600" },
    promoSub: { color: theme.textMuted, fontSize: 11 },
    promoCta: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: theme.accentSoft,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.accentBorder,
    },
    promoCtaText: { color: theme.accent, fontSize: 12, fontWeight: "600" },
    upgradeCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentBorder,
    },
    upgradeTitle: { color: theme.text, fontSize: 13, fontWeight: "600" },
    upgradeSub: { color: theme.textSecondary, fontSize: 11 },
    canvasWrap: { flex: 1, padding: 16, gap: 12 },
    canvas: {
        flex: 1,
        borderRadius: radii.xl,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        position: "relative",
    },
    dotGrid: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // CSS dotted background — works on web; on native we just have flat panel
        ...(Platform.OS === "web"
            ? ({
                  backgroundImage:
                      "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
              } as unknown as object)
            : {}),
    },
    emptyCenter: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 32,
    },
    dropIcon: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 30px rgba(255,92,168,0.3)",
    },
    emptyHeading: { color: theme.text, fontSize: 22, fontWeight: "600" },
    emptySub: {
        color: theme.textSecondary,
        textAlign: "center",
        fontSize: 13,
        lineHeight: 20,
        maxWidth: 360,
    },
    hintRow: { flexDirection: "row", gap: 10, marginTop: 6 },
    hintChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    hintKey: {
        color: theme.text,
        fontSize: 11,
        fontFamily: theme.mono,
        fontWeight: "600",
    },
    hintText: { color: theme.textSecondary, fontSize: 11 },
    bottomBar: { gap: 8 },
    textInputCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.lg,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    textInput: {
        flex: 1,
        color: theme.text,
        fontSize: 14,
        ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as object) : {}),
    },
    sendBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: theme.accent,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    sendBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
    uploadingPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentBorder,
    },
    uploadingText: { color: theme.accent, fontSize: 12 },
    toolRail: {
        position: "absolute",
        top: 84,
        right: 18,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.pill,
        padding: 6,
        gap: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    },
    toolBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "transparent",
    },
});
