import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/lib/theme";

export function WebDashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Web Dashboard - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
  },
  text: {
    color: theme.text,
    fontSize: 24,
  },
});