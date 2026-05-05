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
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
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
            if (token) {
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
    const qrValue = useMemo(() => qrToken ?? "", [qrToken]);
    const formattedCode = useMemo(
        () => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : ""),
        [code]
    );

    const [textDraft, setTextDraft] = useState("");
    const [selectedItemId, setSelectedItemId] = useState<Id<"sharedItems"> | null>(null);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
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

    const handleCopyCode = useCallback(async () => {
        if (!code || typeof navigator === "undefined" || !navigator.clipboard) return;
        await navigator.clipboard.writeText(code);
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
    const useFloatingSidebar = connected && !compact;

    useEffect(() => {
        if (compact || !connected) {
            setSidebarOpen(true);
            return;
        }
        setSidebarOpen(false);
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
            ? `Open Relay on your phone and connect with code ${formattedCode}.`
            : "Open Relay on your phone and scan the QR code shown in Relay web.";

        try {
            if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                await navigator.share({
                    title: "Relay pairing",
                    text: shareText,
                });
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
            }
        } catch {
            // ignore aborted shares
        }

        if (useFloatingSidebar) {
            setSidebarOpen(true);
        }
    }, [formattedCode, useFloatingSidebar]);

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

    const handleConnectAction = useCallback(async () => {
        if (useFloatingSidebar) {
            setSidebarOpen((open) => !open);
            return;
        }
        if (connected) {
            await handleDisconnect();
            return;
        }
        await handleNewCode();
    }, [connected, handleDisconnect, handleNewCode, useFloatingSidebar]);

    const sidebarContent = (
        <>
            <View style={styles.sidebarHeaderRow}>
                <Text style={styles.sectionLabel}>CONNECTION</Text>
                {useFloatingSidebar && (
                    <Pressable
                        style={styles.sidebarCloseButton}
                        onPress={() => setSidebarOpen(false)}
                    >
                        <Ionicons name="close" size={14} color={theme.textSecondary} />
                    </Pressable>
                )}
            </View>

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
                    {connected ? `Connected to ${phoneName ?? "phone"}` : "Waiting for device…"}
                </Text>
            </View>

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

            <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Or enter code on your phone</Text>
                <Text selectable style={styles.codeText}>
                    {formattedCode || "------"}
                </Text>
                <Text style={styles.codeSub}>Enter this in the Relay app</Text>
                <View style={styles.codeButtonsRow}>
                    <SmallButton
                        icon="copy-outline"
                        label="Copy code"
                        onPress={() => {
                            void handleCopyCode();
                        }}
                    />
                    <SmallButton
                        icon="refresh"
                        label="New code"
                        onPress={() => {
                            void handleNewCode();
                        }}
                    />
                </View>
                {connected && (
                    <Pressable style={styles.disconnectBtn} onPress={() => void handleDisconnect()}>
                        <Ionicons
                            name="close-circle-outline"
                            size={14}
                            color={theme.danger}
                        />
                        <Text style={styles.disconnectText}>Disconnect</Text>
                    </Pressable>
                )}
            </View>

            <View style={styles.promoCard}>
                <View style={styles.promoIcon}>
                    <Ionicons name="phone-portrait-outline" size={16} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.promoTitle}>Relay for iOS & Android</Text>
                </View>
                <Pressable
                    style={styles.promoCta}
                    onPress={() => {
                        void handleShareAction();
                    }}
                >
                    <Text style={styles.promoCtaText}>Share setup →</Text>
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
                        <Text style={styles.upgradeSub}>€2.50/mo · save files &amp; history</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.accent} />
                </Pressable>
            )}
        </>
    );

    return (
        <View style={styles.root}>
            <View style={styles.topbar}>
                <View style={styles.brandRow}>
                    <View style={styles.logoSquare}>
                        <Ionicons name="flash" size={18} color="#fff" />
                    </View>
                    <Text style={styles.brandText}>Relay</Text>
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
                        icon={connected ? "flash" : "link-outline"}
                        label={useFloatingSidebar ? (sidebarOpen ? "Hide panel" : "Connect") : connected ? "Connected" : "Refresh code"}
                        active={connected || (useFloatingSidebar && sidebarOpen)}
                        onPress={() => {
                            void handleConnectAction();
                        }}
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
                        <Pressable style={styles.avatar} onPress={() => signOut()}>
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

            <View style={[styles.body, compact && { flexDirection: "column" }]}>
                {!useFloatingSidebar && (
                    <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarScrollContent}>
                        {sidebarContent}
                    </ScrollView>
                )}

                <View style={styles.canvasWrap}>
                    {useFloatingSidebar && (
                        <View pointerEvents="box-none" style={styles.floatingSidebarWrap}>
                            {sidebarOpen ? (
                                <View style={styles.floatingSidebar}>
                                    <ScrollView
                                        style={styles.floatingSidebarScroll}
                                        contentContainerStyle={styles.sidebarScrollContent}
                                    >
                                        {sidebarContent}
                                    </ScrollView>
                                </View>
                            ) : (
                                <Pressable
                                    style={styles.sidebarDockButton}
                                    onPress={() => setSidebarOpen(true)}
                                >
                                    <Ionicons
                                        name="qr-code-outline"
                                        size={16}
                                        color={theme.accent}
                                    />
                                    <Text style={styles.sidebarDockText}>Pair</Text>
                                </Pressable>
                            )}
                        </View>
                    )}

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
                                <Ionicons name="arrow-up" size={16} color="#fff" />
                                <Text style={styles.sendBtnText}>Send</Text>
                            </Pressable>
                        </View>
                        {uploadingCount > 0 && (
                            <View style={styles.uploadingPill}>
                                <ActivityIndicator color={theme.accent} size="small" />
                                <Text style={styles.uploadingText}>Uploading {uploadingCount}…</Text>
                            </View>
                        )}
                    </View>
                </View>

                {!compact && (
                    <View style={styles.toolRail}>
                        <ToolButton
                            icon="qr-code-outline"
                            active={useFloatingSidebar ? sidebarOpen : connected}
                            onPress={() => {
                                void handleConnectAction();
                            }}
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
                            icon="star-outline"
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
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    active?: boolean;
    onPress?: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
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
    setDragOver: (value: boolean) => void;
    onDropFiles: (files: File[]) => void;
    onSelect: (id: Id<"sharedItems">) => void;
    onDelete: (id: Id<"sharedItems">) => void;
    onSave: (id: Id<"sharedItems">) => void;
    onUpdatePosition: (id: Id<"sharedItems">, x: number, y: number) => void;
}) {
    const ref = useRef<View>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (Platform.OS !== "web" || typeof window === "undefined") return;
        const node = ref.current as unknown as HTMLElement | null;
        if (!node) return;
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
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
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
                items.map((item, index) => (
                    <CanvasItem
                        key={item._id}
                        item={item}
                        index={index}
                        canvasW={size.w}
                        canvasH={size.h}
                        onSelect={() => onSelect(item._id)}
                        onDelete={() => onDelete(item._id)}
                        onSave={() => onSave(item._id)}
                        onMove={(nextX, nextY) => onUpdatePosition(item._id, nextX, nextY)}
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
    sidebarScrollContent: {
        padding: 18,
        gap: 14,
    },
    sidebarHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sidebarCloseButton: {
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
    canvasWrap: {
        flex: 1,
        padding: 16,
        gap: 12,
        position: "relative",
    },
    floatingSidebarWrap: {
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 5,
    },
    floatingSidebar: {
        width: 292,
        maxHeight: 560,
        backgroundColor: theme.panel,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.xl,
        overflow: "hidden",
        boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
    },
    floatingSidebarScroll: {
        maxHeight: 560,
    },
    sidebarDockButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    },
    sidebarDockText: {
        color: theme.text,
        fontSize: 13,
        fontWeight: "600",
    },
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
