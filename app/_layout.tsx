import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthAnalyticsSync } from "@/components/AuthAnalyticsSync";
import { theme } from "../lib/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
});

const secureStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
};

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export default function RootLayout() {
    return (
        <ConvexAuthProvider
            client={convex}
            storage={isNative ? secureStorage : undefined}
        >
            <View style={{ flex: 1, backgroundColor: theme.bg }}>
                <StatusBar style="light" />
                <AuthAnalyticsSync />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: theme.bg },
                        animation: "fade",
                    }}
                />
            </View>
        </ConvexAuthProvider>
    );
}