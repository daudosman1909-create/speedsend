import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}

const SIZE_MAP = {
  sm: { box: 32, radius: 10, icon: 16, text: 16, gap: 8 },
  md: { box: 44, radius: 14, icon: 20, text: 20, gap: 10 },
  lg: { box: 64, radius: 18, icon: 28, text: 28, gap: 12 },
} as const;

export function BrandMark({ size = "md", showWordmark = true }: BrandMarkProps) {
  const dims = SIZE_MAP[size];

  return (
    <View style={[styles.row, { gap: dims.gap }]}> 
      <View
        style={[
          styles.box,
          {
            width: dims.box,
            height: dims.box,
            borderRadius: dims.radius,
          },
        ]}
      >
        <Ionicons
          name="paper-plane-outline"
          size={dims.icon}
          color={theme.accentForeground}
        />
      </View>
      {showWordmark ? (
        <Text style={[styles.wordmark, { fontSize: dims.text }]}>SpeedSend</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  box: {
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    color: theme.text,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
