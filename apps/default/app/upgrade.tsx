import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { GridBackdrop } from "@/components/GridBackdrop";

export default function UpgradeScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <GridBackdrop />
            <ScrollView contentContainerStyle={styles.content}>
                <Pressable style={styles.iconBtn} onPress={() => router.back()}>
                    <Ionicons name="close" size={22} color={theme.text} />
                </Pressable>

                <View style={styles.heroIcon}>
                    <Ionicons name="sparkles-outline" size={26} color={theme.accentForeground} />
                </View>

                <Text style={styles.title}>SpeedSend Pro is coming soon</Text>
                <Text style={styles.lead}>
                    Paid plans are not live yet. Saved storage, transfer history, and larger limits are planned next.
                </Text>

                <View style={styles.card}>
                    <Feature text="Saved files across sessions" />
                    <Feature text="Larger transfer limits" />
                    <Feature text="History across devices" />
                </View>

                <Pressable style={styles.btn} onPress={() => router.back()}>
                    <Text style={styles.btnText}>Back</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

function Feature({ text }: { text: string }) {
    return (
        <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={theme.text} />
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.bg,
        paddingTop: 50,
    },
    content: {
        padding: 24,
        gap: 18,
    },
    iconBtn: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        alignSelf: "flex-start",
    },
    heroIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: theme.accent,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    title: {
        color: theme.text,
        fontSize: 28,
        fontWeight: "700",
        letterSpacing: -0.5,
    },
    lead: {
        color: theme.textSecondary,
        fontSize: 15,
        lineHeight: 22,
    },
    card: {
        padding: 16,
        gap: 12,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 16,
    },
    featureRow: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
    },
    featureText: {
        color: theme.text,
        fontSize: 14,
    },
    btn: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.accent,
        paddingVertical: 15,
        borderRadius: 14,
    },
    btnText: {
        color: theme.accentForeground,
        fontSize: 15,
        fontWeight: "700",
    },
});
