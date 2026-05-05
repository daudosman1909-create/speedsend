import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { theme } from "@/lib/theme";

export default function UpgradeScreen() {
  const router = useRouter();
  const me = useQuery(api.users.getMe);
  const upgrade = useMutation(api.users.upgradeToPro);
  const { signIn } = useAuthActions();

  const handleUpgrade = async () => {
    try {
      if (!me) {
        // Not signed in -- sign in anonymously and immediately attach the upgrade
        await signIn("anonymous");
      }
      await upgrade({});
      Alert.alert("You're Pro!", "Saved items will now persist across sessions.");
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Couldn't upgrade", msg);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={28} color="#0a0a0d" />
        </View>
        <Text style={styles.title}>Keep your storage</Text>
        <Text style={styles.priceLine}>
          <Text style={styles.price}>€2.50</Text>
          <Text style={styles.priceSub}>/month</Text>
        </Text>
        <Text style={styles.lead}>Save files and transfer history. Access them anytime, on any device.</Text>

        <View style={styles.compareRow}>
          <PlanCard
            title="Free"
            current={!me?.isPro}
            features={[
              { ok: true, label: "Temporary transfers" },
              { ok: true, label: "Session-based items" },
              { ok: false, label: "Saved storage" },
              { ok: false, label: "Transfer history" },
            ]}
          />
          <PlanCard
            title="Pro"
            current={!!me?.isPro}
            highlight
            features={[
              { ok: true, label: "Keep storage" },
              { ok: true, label: "Saved transfer history" },
              { ok: true, label: "Access across sessions" },
              { ok: true, label: "Larger file limits" },
            ]}
          />
        </View>

        {me?.isPro ? (
          <View style={[styles.btn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
            <Text style={[styles.btnText, { color: theme.text }]}>You're already Pro</Text>
          </View>
        ) : (
          <Pressable style={[styles.btn, { backgroundColor: theme.accent }]} onPress={handleUpgrade}>
            <Ionicons name="sparkles" size={18} color="#0a0a0d" />
            <Text style={[styles.btnText, { color: "#0a0a0d" }]}>Upgrade for €2.50/month</Text>
          </Pressable>
        )}
        <Pressable style={styles.tertiaryBtn} onPress={() => router.back()}>
          <Text style={styles.tertiaryBtnText}>Keep using temporary mode</Text>
        </Pressable>
        <Text style={styles.fineprint}>
          Demo upgrade flow. In production, this connects to Stripe via webhooks managed by Bloom.
        </Text>
      </ScrollView>
    </View>
  );
}

function PlanCard({ title, features, current, highlight }: { title: string; features: { ok: boolean; label: string }[]; current?: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.planCard, highlight && { borderColor: theme.accentBorder, backgroundColor: theme.accentSoft }]}>
      <View style={styles.planHead}>
        <Text style={[styles.planTitle, highlight && { color: theme.accent }]}>{title}</Text>
        {current ? <Text style={styles.currentTag}>Current</Text> : null}
      </View>
      {features.map((f) => (
        <View key={f.label} style={styles.featureRow}>
          <Ionicons name={f.ok ? "checkmark-circle" : "close-circle-outline"} size={14} color={f.ok ? theme.accent : theme.textMuted} />
          <Text style={[styles.featureText, !f.ok && { color: theme.textMuted }]}>{f.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 50 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignSelf: "flex-start" },
  heroIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", marginTop: 8 },
  title: { color: theme.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  priceLine: { flexDirection: "row", alignItems: "baseline" },
  price: { color: theme.accent, fontSize: 36, fontWeight: "700" },
  priceSub: { color: theme.textSecondary, fontSize: 16 },
  lead: { color: theme.textSecondary, fontSize: 15, lineHeight: 22 },
  compareRow: { flexDirection: "row", gap: 10 },
  planCard: { flex: 1, padding: 14, gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14 },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
  currentTag: { color: theme.textMuted, fontSize: 10, fontFamily: theme.mono, letterSpacing: 0.6 },
  featureRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  featureText: { color: theme.text, fontSize: 12 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14 },
  btnText: { fontSize: 15, fontWeight: "700" },
  tertiaryBtn: { paddingVertical: 12, alignItems: "center" },
  tertiaryBtnText: { color: theme.textSecondary, fontSize: 13 },
  fineprint: { color: theme.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
