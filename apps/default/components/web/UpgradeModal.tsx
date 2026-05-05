import React from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, radii } from "@/lib/theme";

interface Props {
    visible: boolean;
    onClose: () => void;
    isAuthed: boolean;
}

export function UpgradeModal({ visible, onClose }: Props) {
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
                        <Ionicons name="sparkles-outline" size={24} color={theme.accentForeground} />
                    </View>

                    <Text style={styles.title}>SpeedSend Pro is coming soon</Text>
                    <Text style={styles.subtitle}>
                        Saved storage, larger limits, and transfer history are planned — just not live yet.
                    </Text>

                    <View style={styles.bullets}>
                        <Bullet text="Saved files across sessions" />
                        <Bullet text="Larger transfer limits" />
                        <Bullet text="History across devices" />
                    </View>

                    <Pressable style={styles.primaryBtn} onPress={onClose}>
                        <Text style={styles.primaryBtnText}>Got it</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

function Bullet({ text }: { text: string }) {
    return (
        <View style={styles.bulletRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color={theme.text} />
            <Text style={styles.bulletText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
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
        gap: 14,
        alignItems: "center",
    },
    close: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
    },
    iconRing: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: theme.text,
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
    },
    subtitle: {
        color: theme.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
    },
    bullets: {
        gap: 10,
        alignSelf: "stretch",
        paddingVertical: 6,
    },
    bulletRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    bulletText: {
        color: theme.textSecondary,
        fontSize: 13,
    },
    primaryBtn: {
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.accent,
        paddingVertical: 12,
        borderRadius: radii.pill,
    },
    primaryBtnText: {
        color: theme.accentForeground,
        fontWeight: "700",
        fontSize: 14,
    },
});
