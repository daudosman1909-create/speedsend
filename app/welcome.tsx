import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { theme } from "../lib/theme";

export default function Welcome() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}
    >
      <Text style={{ color: "white", fontSize: 30, fontWeight: "800" }}>
        SpeedSend
      </Text>

      <Text style={{ color: "#aaa", textAlign: "center", fontSize: 16 }}>
        Welcome to SpeedSend.
      </Text>

      <Pressable
        onPress={() => router.push("/send-text")}
        style={{
          backgroundColor: "white",
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: 14,
        }}
      >
        <Text style={{ color: "black", fontWeight: "700" }}>Send Text</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/inbox")}>
        <Text style={{ color: "white" }}>Inbox</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/connect")}>
        <Text style={{ color: "white" }}>Connect</Text>
      </Pressable>
    </View>
  );
}