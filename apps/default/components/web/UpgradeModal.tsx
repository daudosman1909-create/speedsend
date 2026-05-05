import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, radii } from "@/lib/theme";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";

interface Props {
    visible: boolean;
    onClose: () => void;
    isAuthed: boolean;
}

export function UpgradeModal({ visible, onClose, isAuthed }: Props) {
    const upgradeToPro = useMutation(api.users.upgradeToPro);
    const { signIn } = useAuthActions();
    const [mode, setMode] = useState<"upgrade" | "signin" | "signup">("upgrade");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleUpgrade = async () => {
        setBusy(true);
        setErr(null);
        try {
            await upgradeToPro({});
            onClose();
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <Pressable style={styles.close} onPress={onClose}>
                        <Ionicons name="close" size={18} color={theme.text} />
                    </Pressable>
                    <View style={styles.iconRing}>
                        <Ionicons name="sparkles" size={28} color={theme.accent} />
                    </View>
                    <Text style={styles.title}>
                        {isAuthed && mode === "upgrade"
                            ? "Keep your storage with Relay Pro"
                            : "Sign in to keep your storage"}
                    </Text>
                    <Text style={styles.price}>€2.50<Text style={styles.priceSub}>/month</Text></Text>
                    <View style={styles.bullets}>
                        <Bullet text="Save files and transfer history" />
                        <Bullet text="Access saved files across sessions" />
                        <Bullet text="Larger file limits" />
                        <Bullet text="Cancel anytime" />
                    </View>

                    {err ? <Text style={styles.error}>{err}</Text> : null}

                    {!isAuthed ? (
                        <View style={styles.form}>
                            <TextInput
                                placeholder="Email"
                                placeholderTextColor={theme.textMuted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor={theme.textMuted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                style={styles.input}
                            />
                            <Pressable
                                style={styles.primaryBtn}
                                disabled={busy || !email || !password}
                                onPress={async () => {
                                    setBusy(true);
                                    setErr(null);
                                    try {
                                        await signIn("password", {
                                            email,
                                            password,
                                            flow: mode === "signup" ? "signUp" : "signIn",
                                        });
                                    } catch (e) {
                                        setErr((e as Error).message);
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                <Text style={styles.primaryBtnText}>
                                    {mode === "signup" ? "Create account" : "Sign in"}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    setMode(mode === "signup" ? "signin" : "signup")
                                }
                            >
                                <Text style={styles.toggle}>
                                    {mode === "signup"
                                        ? "Already have an account? Sign in"
                                        : "No account? Create one"}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={styles.googleBtn}
                                onPress={async () => {
                                    setBusy(true);
                                    try {
                                        await signIn("google");
                                    } catch (e) {
                                        setErr((e as Error).message);
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                <Ionicons name="logo-google" size={14} color={theme.text} />
                                <Text style={styles.googleBtnText}>Continue with Google</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.form}>
                            <Pressable
                                style={styles.primaryBtn}
                                disabled={busy}
                                onPress={handleUpgrade}
                            >
                                <Ionicons name="flash" size={14} color="#fff" />
                                <Text style={styles.primaryBtnText}>
                                    Upgrade to Pro
                                </Text>
                            </Pressable>
                            <Pressable onPress={onClose}>
                                <Text style={styles.toggle}>Continue temporary</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

function Bullet({ text }: { text: string }) {
    return (
        <View style={styles.bulletRow}>
            <Ionicons name="checkmark-circle" size={14} color={theme.accent} />
            <Text style={styles.bulletText}>{text}</Text>
        </View>
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
        maxWidth: 420,
        padding: 24,
        gap: 12,
        alignItems: "center",
    },
    close: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    iconRing: {
        width: 64,
        height: 64,
        borderRadius: 18,
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: theme.text,
        fontSize: 18,
        fontWeight: "700",
        textAlign: "center",
    },
    price: { color: theme.accent, fontSize: 32, fontWeight: "700" },
    priceSub: { color: theme.textSecondary, fontSize: 14, fontWeight: "400" },
    bullets: { gap: 8, alignSelf: "stretch" },
    bulletRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    bulletText: { color: theme.textSecondary, fontSize: 13 },
    error: { color: theme.danger, fontSize: 12 },
    form: { gap: 8, alignSelf: "stretch" },
    input: {
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: radii.md,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: theme.text,
        fontSize: 14,
        ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as object) : {}),
    },
    primaryBtn: {
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.accent,
        paddingVertical: 12,
        borderRadius: radii.pill,
    },
    primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    googleBtn: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: 10,
        borderRadius: radii.pill,
    },
    googleBtnText: { color: theme.text, fontSize: 13 },
    toggle: {
        color: theme.textSecondary,
        fontSize: 12,
        textAlign: "center",
        marginTop: 4,
    },
});
