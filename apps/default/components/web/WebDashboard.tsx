import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Platform,
    useWindowDimensions,
    ActivityIndicator,
    Animated,
} from "react-native";
import { useMutation, useQuery, useConvex } from "convex/react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { theme, radii, isLikelyUrl, formatBytes } from "@/lib/theme";
import { useSessionToken, detectBrowserName, detectDeviceName } from "@/lib/session-token";
import { uploadFileBlob } from "@/lib/upload";
import { QRCodeView } from "@/components/QRCodeView";
import { Ionicons } from "@expo/vector-icons";
import { Id } from "@/convex/_generated/dataModel";
import { CanvasItem } from "./CanvasItem";
import { ItemDetailModal } from "./ItemDetailModal";
import { UpgradeModal } from "./UpgradeModal";

type ItemDoc = NonNullable<
    ReturnType<typeof useQuery<typeof api.items.listSessionItems>>
>[number];

interface CanvasSelectionBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface CanvasItemFrame {
    left: number;
    top: number;
    width: number;
    height: number;
}

const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

const CANVAS_CONTROLS = [
    { key: "Drag card", value: "Move one item or the whole selected group" },
    { key: "Left-drag empty space", value: "Draw a box to select multiple items" },
    { key: "Delete / Backspace", value: "Delete the current selection" },
    { key: "Escape", value: "Clear the current selection" },
    { key: "Middle-click + drag", value: "Pan around the canvas" },
    { key: "Drop / Paste", value: "Send files or clipboard content fast" },
] as const;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function formatStorageHint(savedBytes: number) {
    const remainingBytes = Math.max(0, STORAGE_LIMIT_BYTES - savedBytes);
    const remainingPercent = Math.max(
        0,
        Math.min(100, Math.round((remainingBytes / STORAGE_LIMIT_BYTES) * 100))
    );
    return `${remainingPercent}% left · ${formatBytes(remainingBytes)} free`;
}

function intersectsSelectionBox(box: CanvasSelectionBox, frame: CanvasItemFrame) {
    return !(
        box.left + box.width < frame.left ||
        box.left > frame.left + frame.width ||
        box.top + box.height < frame.top ||
        box.top > frame.top + frame.height
    );
}

function createSelectionBox(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number
): CanvasSelectionBox {
    return {
        left: Math.min(startX, currentX),
        top: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
    };
}

function getCanvasItemFrame(
    item: ItemDoc,
    index: number,
    canvasW: number,
    canvasH: number
): CanvasItemFrame {
    const width = item.itemType === "image" || item.itemType === "video" ? 220 : 240;
    const height =
        item.itemType === "image" || item.itemType === "video"
            ? 200
            : item.itemType === "text"
              ? 160
              : 140;
    const defaultX = item.canvasX ?? ((index * 0.18 + 0.08) % 0.7);
    const defaultY = item.canvasY ?? (Math.floor(index / 4) * 0.25 + 0.1);

    return {
        left: Math.max(8, Math.min(canvasW - width - 8, defaultX * canvasW)),
        top: Math.max(8, Math.min(canvasH - height - 8, defaultY * canvasH)),
        width,
        height,
    };
}

export default function WebDashboard() {
    const { token, setToken, loading: tokenLoading } = useSessionToken();
    const { signOut } = useAuthActions();
    const convex = useConvex();
    const authToken = useAuthToken();
    const isAuthed = !!authToken;
    const me = useQuery(api.users.getMe, isAuthed ? {} : "skip");
    const savedItems = useQuery(api.items.listSavedItems, isAuthed ? {} : "skip");

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

    useEffect(() => {
        if (tokenLoading) return;
        if (token && sessionData === null) {
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

    useEffect(() => {
        if (!token) return;
        const id = setInterval(() => {
            heartbeat({ sessionToken: token }).catch(() => {});
        }, 60_000);
        return () => clearInterval(id);
    }, [token, heartbeat]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = () => {
            if (!token) return;
            try {
                const url = (process.env.EXPO_PUBLIC_CONVEX_URL ?? "").replace(/\/$/, "");
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
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [token]);

    const status = sessionData?.status ?? "waiting";
    const connected = status === "connected";
    const code = sessionData?.code;
    const qrToken = sessionData?.qrToken;
    const phoneName = sessionData?.phoneDeviceName;
    const isPro = !!me?.isPro;
    const qrValue = useMemo(() => qrToken ?? "", [qrToken]);
    const formattedCode = useMemo(
        () => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : ""),
        [code]
    );
    const floatingPanel = connected;
    const savedBytes = useMemo(
        () => (savedItems ?? []).reduce((total, item) => total + (item.fileSize ?? 0), 0),
        [savedItems]
    );
    const storageHint = useMemo(() => formatStorageHint(savedBytes), [savedBytes]);

    const [textDraft, setTextDraft] = useState("");
    const [selectedItemId, setSelectedItemId] = useState<Id<"sharedItems"> | null>(null);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
    const textInputRef = useRef<TextInput>(null);

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
            setUploadingCount((count) => count + files.length);
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
                                  : mime.includes("text") ||
                                      mime.includes("document") ||
                                      mime.includes("word")
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
                    } catch (error) {
                        console.error("upload failed", error);
                    }
                }
            } finally {
                setUploadingCount((count) => Math.max(0, count - files.length));
            }
        },
        [token, convex, sendItem]
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const onPaste = async (event: WindowEventMap["paste"]) => {
            if (!token) return;
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
            )
                return;
            const dataTransfer = event.clipboardData;
            if (!dataTransfer) return;
            const files: Array<File> = [];
            for (let index = 0; index < dataTransfer.items.length; index++) {
                const item = dataTransfer.items[index];
                if (item.kind === "file") {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
            if (files.length > 0) {
                event.preventDefault();
                await sendFiles(files);
                return;
            }
            const pastedText = dataTransfer.getData("text/plain");
            if (pastedText) {
                event.preventDefault();
                await sendText(pastedText);
            }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, [token, sendText, sendFiles]);

    const handleDisconnect = useCallback(async () => {
        if (!token) return;
        await disconnectSession({ sessionToken: token });
    }, [token, disconnectSession]);

    const handleNewCode = useCallback(async () => {
        if (!token) return;
        await newCode({ sessionToken: token });
    }, [token, newCode]);

    useEffect(() => {
        if (!token || connected) return;
        if (!code || !qrToken) {
            void newCode({ sessionToken: token }).catch(() => {});
        }
        const intervalId = setInterval(() => {
            void newCode({ sessionToken: token }).catch(() => {});
        }, 30_000);
        return () => clearInterval(intervalId);
    }, [code, connected, newCode, qrToken, token]);

    const handleCopyCode = useCallback(async () => {
        if (!code || typeof navigator === "undefined" || !navigator.clipboard) return;
        await navigator.clipboard.writeText(code);
    }, [code]);

    const handleSaveItem = useCallback(
        async (id: Id<"sharedItems">) => {
            if (!token) return;
            const result = await saveItem({ sessionToken: token, itemId: id });
            if (result.needsUpgrade) setUpgradeOpen(true);
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

    const handleDeleteSelection = useCallback(
        async (ids: Id<"sharedItems">[]) => {
            if (!token || ids.length === 0) return;
            await Promise.all(
                ids.map((id) => deleteItem({ sessionToken: token, itemId: id }))
            );
            if (selectedItemId && ids.includes(selectedItemId)) {
                setSelectedItemId(null);
            }
        },
        [deleteItem, selectedItemId, token]
    );

    const dimensions = useWindowDimensions();
    const compact = dimensions.width < 1024;

    useEffect(() => {
        if (compact || !connected) {
            setPanelOpen(true);
            return;
        }
        setPanelOpen(false);
    }, [compact, connected]);

    const focusComposer = useCallback(() => {
        textInputRef.current?.focus();
    }, []);

    const handleClipboardAction = useCallback(async () => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            try {
                const clipboardText = await navigator.clipboard.readText();
                if (clipboardText.trim()) {
                    await sendText(clipboardText);
                    return;
                }
            } catch {
                // ignore clipboard permission failures and fall back below
            }
        }

        if (textDraft.trim()) {
            await sendText(textDraft);
            setTextDraft("");
            return;
        }

        focusComposer();
    }, [focusComposer, sendText, textDraft]);

    const handleShareAction = useCallback(async () => {
        const shareText = formattedCode
            ? `Open SpeedSend on your phone and connect with code ${formattedCode}.`
            : "Open SpeedSend on your phone and scan the QR code shown in SpeedSend web.";

        try {
            if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                await navigator.share({
                    title: "SpeedSend pairing",
                    text: shareText,
                });
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
            }
        } catch {
            // ignore aborted shares
        }

        if (floatingPanel) setPanelOpen(true);
    }, [formattedCode, floatingPanel]);

    const openFilePicker = useCallback(
        (accept?: string) => {
            if (Platform.OS !== "web" || typeof document === "undefined") return;
            const input = document.createElement("input");
            input.type = "file";
            input.multiple = true;
            if (accept) input.accept = accept;
            input.onchange = () => {
                const files = input.files ? Array.from(input.files) : [];
                void sendFiles(files);
            };
            input.click();
        },
        [sendFiles]
    );

    const handleConnectAction = useCallback(() => {
        if (connected) {
            setPanelOpen((open) => !open);
            return;
        }
        setPanelOpen(true);
    }, [connected]);

    return (
        <View style={styles.root}>
            <View style={styles.topbar}>
                <View style={styles.brandRow}>
                    <View style={styles.logoSquare}>
                        <Ionicons name="paper-plane-outline" size={16} color={theme.accentForeground} />
                    </View>
                    <Text style={styles.brandText}>SpeedSend</Text>
                </View>
                <View style={styles.topActions}>
                    <PillButton
                        icon="clipboard-outline"
                        label="Clipboard"
                        onPress={() => {
                            void handleClipboardAction();
                        }}
                    />
                    <PillButton
                        icon={connected ? "phone-portrait-outline" : "qr-code-outline"}
                        label={connected ? (panelOpen ? "Hide info" : "Device") : "Pair"}
                        active={connected || panelOpen}
                        onPress={handleConnectAction}
                    />
                    <PillButton
                        icon="share-outline"
                        label="Share"
                        primary
                        onPress={() => {
                            void handleShareAction();
                        }}
                    />
                    {me ? (
                        <Pressable style={styles.accountChip} onPress={() => signOut()}>
                            <Text style={styles.accountChipText}>Sign out</Text>
                        </Pressable>
                    ) : (
                        <View style={styles.guestChip}>
                            <Text style={styles.guestChipText}>Guest</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.body}>
                <View style={styles.canvasWrap}>
                    <DropCanvas
                        items={items ?? []}
                        connected={connected}
                        dragOver={dragOver}
                        setDragOver={setDragOver}
                        onDropFiles={sendFiles}
                        onSelect={(id) => setSelectedItemId(id)}
                        onDelete={handleDeleteItem}
                        onDeleteSelection={handleDeleteSelection}
                        onSave={handleSaveItem}
                        storageHint={storageHint}
                        onUpdatePosition={(id, x, y) => {
                            if (!token) return;
                            void updateItemPosition({
                                sessionToken: token,
                                itemId: id,
                                x,
                                y,
                            });
                        }}
                    />

                    {panelOpen && (
                        <View
                            pointerEvents="box-none"
                            style={[
                                styles.panelLayer,
                                floatingPanel
                                    ? styles.panelLayerFloating
                                    : styles.panelLayerCentered,
                            ]}
                        >
                            <ConnectionPanel
                                connected={connected}
                                phoneName={phoneName}
                                qrValue={qrValue}
                                formattedCode={formattedCode}
                                showClose={floatingPanel}
                                isPro={isPro}
                                onClose={() => setPanelOpen(false)}
                                onCopyCode={() => {
                                    void handleCopyCode();
                                }}
                                onNewCode={() => {
                                    void handleNewCode();
                                }}
                                onDisconnect={() => {
                                    void handleDisconnect();
                                }}
                                onShare={() => {
                                    void handleShareAction();
                                }}
                                onUpgrade={() => setUpgradeOpen(true)}
                            />
                        </View>
                    )}

                    <View style={styles.bottomBar}>
                        <View style={styles.textInputCard}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={16}
                                color={theme.textSecondary}
                            />
                            <TextInput
                                ref={textInputRef}
                                style={styles.textInput}
                                placeholder={
                                    connected
                                        ? "Type text to send to your phone…"
                                        : "Type or paste anything once your phone is paired…"
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
                                style={styles.attachButton}
                                onPress={() => openFilePicker()}
                            >
                                <Ionicons name="attach-outline" size={16} color={theme.textSecondary} />
                            </Pressable>
                            <Pressable
                                style={[styles.sendBtn, !textDraft.trim() && { opacity: 0.4 }]}
                                disabled={!textDraft.trim()}
                                onPress={async () => {
                                    await sendText(textDraft);
                                    setTextDraft("");
                                }}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={16}
                                    color={theme.accentForeground}
                                />
                                <Text style={styles.sendBtnText}>Send</Text>
                            </Pressable>
                        </View>
                        {uploadingCount > 0 && (
                            <View style={styles.uploadingPill}>
                                <ActivityIndicator color={theme.accentForeground} size="small" />
                                <Text style={styles.uploadingText}>Uploading {uploadingCount}…</Text>
                            </View>
                        )}
                    </View>
                </View>

                {!compact && (
                    <View style={styles.toolRail}>
                        <ToolButton
                            icon={connected ? "phone-portrait-outline" : "qr-code-outline"}
                            active={connected || panelOpen}
                            onPress={handleConnectAction}
                        />
                        <ToolButton
                            icon="cloud-upload-outline"
                            onPress={() => openFilePicker()}
                        />
                        <ToolButton icon="text-outline" onPress={focusComposer} />
                        <ToolButton
                            icon="clipboard-outline"
                            onPress={() => {
                                void handleClipboardAction();
                            }}
                        />
                        <ToolButton
                            icon="image-outline"
                            onPress={() => openFilePicker("image/*,video/*")}
                        />
                        <ToolButton
                            icon="sparkles-outline"
                            active={upgradeOpen}
                            onPress={() => setUpgradeOpen(true)}
                        />
                    </View>
                )}
            </View>

            <ItemDetailModal
                visible={!!selectedItemId}
                onClose={() => setSelectedItemId(null)}
                item={items?.find((item) => item._id === selectedItemId) ?? null}
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

function ConnectionPanel({
    connected,
    phoneName,
    qrValue,
    formattedCode,
    showClose,
    isPro,
    onClose,
    onCopyCode,
    onNewCode,
    onDisconnect,
    onShare,
    onUpgrade,
}: {
    connected: boolean;
    phoneName?: string;
    qrValue: string;
    formattedCode: string;
    showClose: boolean;
    isPro: boolean;
    onClose: () => void;
    onCopyCode: () => void;
    onNewCode: () => void;
    onDisconnect: () => void;
    onShare: () => void;
    onUpgrade: () => void;
}) {
    return (
        <View style={styles.panelCard}>
            <View style={styles.panelHeaderRow}>
                <Text style={styles.sectionLabel}>CONNECTION</Text>
                {showClose && (
                    <Pressable style={styles.panelCloseButton} onPress={onClose}>
                        <Ionicons name="close" size={14} color={theme.textSecondary} />
                    </Pressable>
                )}
            </View>

            <View style={styles.statusRow}>
                <View
                    style={[
                        styles.statusDot,
                        {
                            backgroundColor: connected ? theme.accent : theme.textMuted,
                        },
                    ]}
                />
                <Text style={styles.statusText}>
                    {connected
                        ? `Connected to ${phoneName ?? "phone"}`
                        : "Ready to pair your phone"}
                </Text>
            </View>

            {connected ? (
                <View style={styles.connectedCard}>
                    <View style={styles.connectedDeviceRow}>
                        <View style={styles.connectedDeviceIcon}>
                            <Ionicons
                                name="phone-portrait-outline"
                                size={16}
                                color={theme.accentForeground}
                            />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.connectedDeviceTitle}>
                                {phoneName ?? "Connected phone"}
                            </Text>
                            <Text style={styles.connectedDeviceMeta}>
                                Temporary session active
                            </Text>
                        </View>
                    </View>
                    <Pressable style={styles.disconnectBtn} onPress={onDisconnect}>
                        <Ionicons
                            name="close-circle-outline"
                            size={14}
                            color={theme.danger}
                        />
                        <Text style={styles.disconnectText}>Disconnect</Text>
                    </Pressable>
                </View>
            ) : (
                <>
                    <View style={styles.qrCard}>
                        {qrValue ? (
                            <View style={{ position: "relative", alignItems: "center" }}>
                                <QRCodeView value={qrValue} size={180} />
                            </View>
                        ) : (
                            <ActivityIndicator color={theme.accent} />
                        )}
                        <Text style={styles.qrHelper}>Scan with SpeedSend on your phone</Text>
                    </View>

                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>Or enter code on your phone</Text>
                        <Text selectable style={styles.codeText}>
                            {formattedCode || "------"}
                        </Text>
                        <Text style={styles.codeSub}>Enter this in the SpeedSend app · refreshes every 30s</Text>
                        <View style={styles.codeButtonsRow}>
                            <SmallButton
                                icon="copy-outline"
                                label="Copy code"
                                onPress={onCopyCode}
                            />
                            <SmallButton
                                icon="refresh"
                                label="New code"
                                onPress={onNewCode}
                            />
                        </View>
                    </View>

                    <View style={styles.promoCard}>
                        <View style={styles.promoIcon}>
                            <Ionicons
                                name="phone-portrait-outline"
                                size={16}
                                color={theme.accentForeground}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.promoTitle}>SpeedSend for iOS & Android</Text>
                        </View>
                        <Pressable style={styles.promoCta} onPress={onShare}>
                            <Text style={styles.promoCtaText}>Share setup</Text>
                        </Pressable>
                    </View>

                    {!isPro && (
                        <Pressable style={styles.upgradeCard} onPress={onUpgrade}>
                            <Ionicons
                                name="sparkles"
                                size={16}
                                color={theme.accentForeground}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.upgradeTitle}>Pro storage</Text>
                                <Text style={styles.upgradeSub}>Coming soon</Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={theme.textSecondary}
                            />
                        </Pressable>
                    )}
                </>
            )}
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
                primary && styles.pillBtnPrimary,
                active && !primary && styles.pillBtnActive,
            ]}
        >
            <Ionicons
                name={icon}
                size={14}
                color={
                    primary
                        ? theme.accentForeground
                        : active
                          ? theme.text
                          : theme.textSecondary
                }
            />
            <Text
                style={[
                    styles.pillBtnText,
                    primary && styles.pillBtnPrimaryText,
                    active && !primary && styles.pillBtnActiveText,
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
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    active?: boolean;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.toolBtn, active && styles.toolBtnActive]}
        >
            <Ionicons
                name={icon}
                size={16}
                color={active ? theme.text : theme.textSecondary}
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
    onDeleteSelection,
    onSave,
    storageHint,
    onUpdatePosition,
}: {
    items: ItemDoc[];
    connected: boolean;
    dragOver: boolean;
    setDragOver: (value: boolean) => void;
    onDropFiles: (files: File[]) => void;
    onSelect: (id: Id<"sharedItems">) => void;
    onDelete: (id: Id<"sharedItems">) => void;
    onDeleteSelection: (ids: Id<"sharedItems">[]) => void;
    onSave: (id: Id<"sharedItems">) => void;
    storageHint: string;
    onUpdatePosition: (id: Id<"sharedItems">, x: number, y: number) => void;
}) {
    const viewportRef = useRef<View>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const surfaceWidth = Math.max(1800, Math.round(size.w * 2.2));
    const surfaceHeight = Math.max(1200, Math.round(size.h * 1.9));
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [selectedItemIds, setSelectedItemIds] = useState<Id<"sharedItems">[]>([]);
    const [selectionBox, setSelectionBox] = useState<CanvasSelectionBox | null>(null);
    const [dragState, setDragState] = useState<{
        ids: Id<"sharedItems">[];
        deltaX: number;
        deltaY: number;
    } | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const infoAnim = useRef(new Animated.Value(0)).current;
    const panRef = useRef(pan);
    const selectedItemIdsRef = useRef<Id<"sharedItems">[]>([]);

    const itemFrames = useMemo(() => {
        const frames = new Map<Id<"sharedItems">, CanvasItemFrame>();
        items.forEach((item, index) => {
            frames.set(item._id, getCanvasItemFrame(item, index, surfaceWidth, surfaceHeight));
        });
        return frames;
    }, [items, surfaceHeight, surfaceWidth]);

    const selectedItemIdSet = useMemo(
        () => new Set<Id<"sharedItems">>(selectedItemIds),
        [selectedItemIds]
    );

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    useEffect(() => {
        selectedItemIdsRef.current = selectedItemIds;
    }, [selectedItemIds]);

    useEffect(() => {
        Animated.spring(infoAnim, {
            toValue: infoOpen ? 1 : 0,
            tension: 180,
            friction: 20,
            useNativeDriver: true,
        }).start();
    }, [infoAnim, infoOpen]);

    useEffect(() => {
        setSelectedItemIds((previousIds) => {
            const nextIds = previousIds.filter((id) => itemFrames.has(id));
            return nextIds.length === previousIds.length ? previousIds : nextIds;
        });
    }, [itemFrames]);

    useEffect(() => {
        if (!size.w || !size.h) return;
        const minX = Math.min(0, size.w - surfaceWidth);
        const minY = Math.min(0, size.h - surfaceHeight);
        setPan({
            x: Math.max(minX, Math.min(0, (size.w - surfaceWidth) / 2)),
            y: Math.max(minY, Math.min(0, (size.h - surfaceHeight) / 2)),
        });
    }, [size.w, size.h, surfaceWidth, surfaceHeight]);

    const clampGroupDelta = useCallback(
        (ids: Id<"sharedItems">[], deltaX: number, deltaY: number) => {
            let minLeft = Number.POSITIVE_INFINITY;
            let minTop = Number.POSITIVE_INFINITY;
            let maxRight = Number.NEGATIVE_INFINITY;
            let maxBottom = Number.NEGATIVE_INFINITY;

            ids.forEach((id) => {
                const frame = itemFrames.get(id);
                if (!frame) return;
                minLeft = Math.min(minLeft, frame.left);
                minTop = Math.min(minTop, frame.top);
                maxRight = Math.max(maxRight, frame.left + frame.width);
                maxBottom = Math.max(maxBottom, frame.top + frame.height);
            });

            if (!Number.isFinite(minLeft) || !Number.isFinite(minTop)) {
                return { x: deltaX, y: deltaY };
            }

            return {
                x: clamp(deltaX, 8 - minLeft, surfaceWidth - 8 - maxRight),
                y: clamp(deltaY, 8 - minTop, surfaceHeight - 8 - maxBottom),
            };
        },
        [itemFrames, surfaceHeight, surfaceWidth]
    );

    const handleActivateSelection = useCallback((id: Id<"sharedItems">) => {
        setSelectedItemIds((previousIds) =>
            previousIds.length === 1 && previousIds[0] === id ? previousIds : [id]
        );
    }, []);

    const handlePreviewDrag = useCallback(
        (ids: Id<"sharedItems">[], deltaX: number, deltaY: number) => {
            if (ids.length === 0) {
                setDragState(null);
                return;
            }
            const nextDelta = clampGroupDelta(ids, deltaX, deltaY);
            setDragState({ ids, deltaX: nextDelta.x, deltaY: nextDelta.y });
        },
        [clampGroupDelta]
    );

    const handleCommitDrag = useCallback(
        (ids: Id<"sharedItems">[], deltaX: number, deltaY: number) => {
            const nextDelta = clampGroupDelta(ids, deltaX, deltaY);
            setDragState(null);
            ids.forEach((id) => {
                const frame = itemFrames.get(id);
                if (!frame) return;
                onUpdatePosition(
                    id,
                    (frame.left + nextDelta.x) / surfaceWidth,
                    (frame.top + nextDelta.y) / surfaceHeight
                );
            });
        },
        [clampGroupDelta, itemFrames, onUpdatePosition, surfaceHeight, surfaceWidth]
    );

    useEffect(() => {
        if (Platform.OS !== "web" || typeof window === "undefined") return;
        const node = viewportRef.current as unknown as HTMLElement | null;
        if (!node) return;

        const clampPan = (next: { x: number; y: number }) => ({
            x: Math.max(Math.min(0, next.x), Math.min(0, size.w - surfaceWidth)),
            y: Math.max(Math.min(0, next.y), Math.min(0, size.h - surfaceHeight)),
        });

        const getSurfacePoint = (clientX: number, clientY: number) => {
            const rect = node.getBoundingClientRect();
            return {
                x: clamp(clientX - rect.left - panRef.current.x, 0, surfaceWidth),
                y: clamp(clientY - rect.top - panRef.current.y, 0, surfaceHeight),
            };
        };

        const onDragOver = (event: DragEvent) => {
            event.preventDefault();
            setDragOver(true);
        };
        const onDragLeave = (event: DragEvent) => {
            event.preventDefault();
            setDragOver(false);
        };
        const onDrop = (event: DragEvent) => {
            event.preventDefault();
            setDragOver(false);
            if (!event.dataTransfer) return;
            const files: Array<File> = [];
            for (let index = 0; index < event.dataTransfer.files.length; index++) {
                files.push(event.dataTransfer.files[index]);
            }
            if (files.length > 0) onDropFiles(files);
        };

        let panning = false;
        let selecting = false;
        let didSelect = false;
        let startX = 0;
        let startY = 0;
        let basePan = panRef.current;
        let selectionStart = { x: 0, y: 0 };
        const selectionThreshold = 4;

        const onMouseDown = (event: MouseEvent) => {
            if (event.button === 1) {
                panning = true;
                startX = event.clientX;
                startY = event.clientY;
                basePan = panRef.current;
                node.style.cursor = "grabbing";
                event.preventDefault();
                return;
            }

            if (event.button !== 0) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-canvas-item-root='true']")) return;
            selecting = true;
            didSelect = false;
            startX = event.clientX;
            startY = event.clientY;
            selectionStart = getSurfacePoint(event.clientX, event.clientY);
            setDragState(null);
            setSelectionBox({
                left: selectionStart.x,
                top: selectionStart.y,
                width: 0,
                height: 0,
            });
            event.preventDefault();
        };

        const onMouseMove = (event: MouseEvent) => {
            if (panning) {
                event.preventDefault();
                setPan(
                    clampPan({
                        x: basePan.x + (event.clientX - startX),
                        y: basePan.y + (event.clientY - startY),
                    })
                );
                return;
            }

            if (!selecting) return;
            const nextPoint = getSurfacePoint(event.clientX, event.clientY);
            if (
                !didSelect &&
                Math.hypot(event.clientX - startX, event.clientY - startY) >=
                    selectionThreshold
            ) {
                didSelect = true;
            }
            setSelectionBox(
                createSelectionBox(
                    selectionStart.x,
                    selectionStart.y,
                    nextPoint.x,
                    nextPoint.y
                )
            );
            event.preventDefault();
        };

        const onMouseUp = (event: MouseEvent) => {
            if (panning) {
                panning = false;
                node.style.cursor = "default";
                return;
            }

            if (!selecting) return;
            selecting = false;
            const nextPoint = getSurfacePoint(event.clientX, event.clientY);
            const nextSelection = createSelectionBox(
                selectionStart.x,
                selectionStart.y,
                nextPoint.x,
                nextPoint.y
            );
            if (!didSelect) {
                setSelectedItemIds([]);
                setSelectionBox(null);
                return;
            }
            const nextSelectedIds = items
                .filter((item) => {
                    const frame = itemFrames.get(item._id);
                    return frame ? intersectsSelectionBox(nextSelection, frame) : false;
                })
                .map((item) => item._id);
            setSelectedItemIds(nextSelectedIds);
            setSelectionBox(null);
        };

        const onAuxClick = (event: MouseEvent) => {
            if (event.button === 1) event.preventDefault();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable)
            ) {
                return;
            }
            if (event.key === "Escape") {
                setSelectedItemIds([]);
                setSelectionBox(null);
                setDragState(null);
                setInfoOpen(false);
                return;
            }
            if (
                (event.key === "Delete" || event.key === "Backspace") &&
                selectedItemIdsRef.current.length > 0
            ) {
                event.preventDefault();
                const ids = [...selectedItemIdsRef.current];
                setSelectedItemIds([]);
                void onDeleteSelection(ids);
            }
        };

        node.addEventListener("dragover", onDragOver);
        node.addEventListener("dragleave", onDragLeave);
        node.addEventListener("drop", onDrop);
        node.addEventListener("mousedown", onMouseDown);
        node.addEventListener("auxclick", onAuxClick);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("keydown", onKeyDown);

        return () => {
            node.removeEventListener("dragover", onDragOver);
            node.removeEventListener("dragleave", onDragLeave);
            node.removeEventListener("drop", onDrop);
            node.removeEventListener("mousedown", onMouseDown);
            node.removeEventListener("auxclick", onAuxClick);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [
        itemFrames,
        items,
        onDeleteSelection,
        onDropFiles,
        setDragOver,
        size.h,
        size.w,
        surfaceHeight,
        surfaceWidth,
    ]);

    return (
        <View
            ref={viewportRef}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ w: width, h: height });
            }}
            style={[styles.canvas, dragOver && styles.canvasDragOver]}
        >
            <View
                style={[
                    styles.canvasSurface,
                    {
                        width: surfaceWidth,
                        height: surfaceHeight,
                        transform: [{ translateX: pan.x }, { translateY: pan.y }],
                    },
                ]}
            >
                <View style={styles.dotGrid} pointerEvents="none" />
                {items.map((item, index) => (
                    <CanvasItem
                        key={item._id}
                        item={item}
                        index={index}
                        canvasW={surfaceWidth}
                        canvasH={surfaceHeight}
                        isSelected={selectedItemIdSet.has(item._id)}
                        selectedItemIds={selectedItemIds}
                        dragOffset={
                            dragState?.ids.includes(item._id)
                                ? { x: dragState.deltaX, y: dragState.deltaY }
                                : undefined
                        }
                        onSelect={() => onSelect(item._id)}
                        onActivateSelection={handleActivateSelection}
                        onDelete={() => onDelete(item._id)}
                        onSave={() => onSave(item._id)}
                        onPreviewDrag={handlePreviewDrag}
                        onCommitDrag={handleCommitDrag}
                    />
                ))}
                {selectionBox ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.selectionBox,
                            {
                                left: selectionBox.left,
                                top: selectionBox.top,
                                width: selectionBox.width,
                                height: selectionBox.height,
                            },
                        ]}
                    />
                ) : null}
            </View>

            <View pointerEvents="box-none" style={styles.canvasHintWrap}>
                <Animated.View
                    pointerEvents={infoOpen ? "auto" : "none"}
                    style={[
                        styles.canvasInfoCard,
                        {
                            opacity: infoAnim,
                            transform: [
                                {
                                    translateY: infoAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                },
                                {
                                    scale: infoAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.96, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.canvasInfoTitle}>Canvas controls</Text>
                    <View style={styles.canvasInfoList}>
                        {CANVAS_CONTROLS.map((control) => (
                            <View key={control.key} style={styles.canvasInfoRow}>
                                <Text style={styles.canvasInfoKey}>{control.key}</Text>
                                <Text style={styles.canvasInfoValue}>{control.value}</Text>
                            </View>
                        ))}
                    </View>
                </Animated.View>

                <View style={styles.canvasHudRow}>
                    <View style={styles.canvasHintChip}>
                        <Text style={styles.canvasHintText}>
                            {selectedItemIds.length > 0
                                ? `${selectedItemIds.length} selected · drag a selected card to move · press Delete to remove`
                                : connected
                                  ? "Drop or paste files · left-drag empty space to multi-select · middle-click and drag to move around"
                                  : "Pair a phone, then drop or paste files · left-drag empty space to multi-select · middle-click and drag to move around"}
                        </Text>
                    </View>
                    <View style={styles.storageChip}>
                        <Ionicons name="server-outline" size={12} color={theme.textSecondary} />
                        <Text style={styles.storageChipText}>Storage {storageHint}</Text>
                    </View>
                    <Pressable
                        style={[styles.canvasInfoButton, infoOpen && styles.canvasInfoButtonActive]}
                        onPress={() => setInfoOpen((open) => !open)}
                    >
                        <Ionicons
                            name="information-circle-outline"
                            size={14}
                            color={infoOpen ? theme.text : theme.textSecondary}
                        />
                        <Text
                            style={[
                                styles.canvasInfoButtonText,
                                infoOpen && styles.canvasInfoButtonTextActive,
                            ]}
                        >
                            Info
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: theme.bg,
        ...(Platform.OS === "web" ? ({ minHeight: "100vh" } as unknown as object) : {}),
    },
    topbar: {
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.bg,
    },
    brandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    logoSquare: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    brandText: {
        color: theme.text,
        fontWeight: "700",
        fontSize: 18,
        letterSpacing: -0.2,
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
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    pillBtnPrimary: {
        backgroundColor: theme.accent,
        borderColor: theme.accentBright,
    },
    pillBtnActive: {
        backgroundColor: theme.cardElevated,
        borderColor: theme.border,
    },
    pillBtnText: {
        color: theme.textSecondary,
        fontSize: 13,
    },
    pillBtnPrimaryText: {
        color: theme.accentForeground,
        fontWeight: "600",
    },
    pillBtnActiveText: {
        color: theme.text,
    },
    accountChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    accountChipText: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "600",
    },
    guestChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
    },
    guestChipText: {
        color: theme.textMuted,
        fontSize: 13,
        fontWeight: "500",
    },
    body: {
        flex: 1,
        flexDirection: "row",
    },
    canvasWrap: {
        flex: 1,
        padding: 18,
        gap: 12,
        position: "relative",
    },
    canvas: {
        flex: 1,
        borderRadius: 24,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
        position: "relative",
    },
    canvasDragOver: {
        borderColor: theme.accentBorder,
        backgroundColor: theme.card,
    },
    canvasSurface: {
        position: "absolute",
        top: 0,
        left: 0,
    },
    selectionBox: {
        position: "absolute",
        borderWidth: 1,
        borderColor: theme.accentBorder,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    dotGrid: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        ...(Platform.OS === "web"
            ? ({
                  backgroundImage:
                      "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
              } as unknown as object)
            : {}),
    },
    canvasHintWrap: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        alignItems: "center",
        gap: 10,
    },
    canvasHintChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: "rgba(15,15,19,0.88)",
        borderWidth: 1,
        borderColor: theme.border,
        maxWidth: "100%",
    },
    canvasHintText: {
        color: theme.textSecondary,
        fontSize: 12,
        textAlign: "center",
    },
    canvasHudRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
    },
    storageChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: "rgba(15,15,19,0.88)",
        borderWidth: 1,
        borderColor: theme.border,
    },
    storageChipText: {
        color: theme.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },
    canvasInfoButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: "rgba(15,15,19,0.88)",
        borderWidth: 1,
        borderColor: theme.border,
    },
    canvasInfoButtonActive: {
        backgroundColor: theme.cardElevated,
        borderColor: theme.accentBorder,
    },
    canvasInfoButtonText: {
        color: theme.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },
    canvasInfoButtonTextActive: {
        color: theme.text,
    },
    canvasInfoCard: {
        width: 420,
        maxWidth: "100%",
        padding: 14,
        borderRadius: 18,
        backgroundColor: "rgba(15,15,19,0.96)",
        borderWidth: 1,
        borderColor: theme.border,
        boxShadow: "0 14px 28px rgba(0,0,0,0.28)",
    },
    canvasInfoTitle: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 8,
    },
    canvasInfoList: {
        gap: 8,
    },
    canvasInfoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
    },
    canvasInfoKey: {
        color: theme.text,
        fontSize: 12,
        fontWeight: "600",
        minWidth: 132,
    },
    canvasInfoValue: {
        flex: 1,
        color: theme.textSecondary,
        fontSize: 12,
        lineHeight: 17,
    },
    panelLayer: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 5,
    },
    panelLayerFloating: {
        top: 18,
        left: 18,
        right: undefined,
    },
    panelLayerCentered: {
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    panelCard: {
        width: 320,
        maxWidth: "100%",
        padding: 16,
        gap: 14,
        backgroundColor: "rgba(24,24,28,0.96)",
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 24,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    },
    panelHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    panelCloseButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
    },
    sectionLabel: {
        color: theme.textMuted,
        fontSize: 10,
        fontFamily: theme.mono,
        letterSpacing: 1.4,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "600",
    },
    qrCard: {
        backgroundColor: theme.card,
        padding: 14,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: "center",
        gap: 10,
    },
    qrHelper: {
        color: theme.textMuted,
        fontSize: 11,
        fontFamily: theme.mono,
        letterSpacing: 0.5,
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
        letterSpacing: 1.1,
        fontFamily: theme.mono,
    },
    codeText: {
        color: theme.text,
        fontSize: 31,
        fontWeight: "600",
        fontFamily: theme.mono,
        letterSpacing: 6,
    },
    codeSub: {
        color: theme.textSecondary,
        fontSize: 12,
    },
    codeButtonsRow: {
        flexDirection: "row",
        gap: 8,
        marginTop: 2,
    },
    smallBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
    },
    smallBtnText: {
        color: theme.textSecondary,
        fontSize: 12,
    },
    connectedCard: {
        gap: 12,
        padding: 14,
        borderRadius: radii.lg,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    connectedDeviceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    connectedDeviceIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.accent,
    },
    connectedDeviceTitle: {
        color: theme.text,
        fontSize: 14,
        fontWeight: "600",
    },
    connectedDeviceMeta: {
        color: theme.textSecondary,
        fontSize: 12,
    },
    disconnectBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: "rgba(255,94,108,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,94,108,0.25)",
        alignSelf: "flex-start",
    },
    disconnectText: {
        color: theme.danger,
        fontSize: 12,
        fontWeight: "600",
    },
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
        borderRadius: 10,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    promoTitle: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "600",
    },
    promoCta: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: theme.cardElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    promoCtaText: {
        color: theme.text,
        fontSize: 12,
        fontWeight: "600",
    },
    upgradeCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    upgradeTitle: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "600",
    },
    upgradeSub: {
        color: theme.textSecondary,
        fontSize: 11,
    },
    bottomBar: {
        gap: 8,
    },
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
    attachButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.cardElevated,
        borderWidth: 1,
        borderColor: theme.border,
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
    sendBtnText: {
        color: theme.accentForeground,
        fontWeight: "700",
        fontSize: 13,
    },
    uploadingPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: radii.pill,
        backgroundColor: theme.accent,
        borderWidth: 1,
        borderColor: theme.accentBright,
    },
    uploadingText: {
        color: theme.accentForeground,
        fontSize: 12,
        fontWeight: "600",
    },
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
    },
    toolBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "transparent",
    },
    toolBtnActive: {
        backgroundColor: theme.cardElevated,
        borderColor: theme.border,
    },
});
