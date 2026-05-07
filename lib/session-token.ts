import { Platform } from "react-native";
import { useEffect, useState, useCallback } from "react";
import * as SecureStore from "expo-secure-store";

const KEY = "relay.sessionToken";

export async function getSessionToken(): Promise<string | null> {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem(KEY);
    }
    return await SecureStore.getItemAsync(KEY);
}

export async function setSessionToken(token: string | null) {
    if (Platform.OS === "web") {
        if (typeof window === "undefined") return;
        if (token) window.localStorage.setItem(KEY, token);
        else window.localStorage.removeItem(KEY);
        return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
}

export function useSessionToken() {
    const [token, setToken] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getSessionToken().then((t) => {
            if (!cancelled) setToken(t);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const save = useCallback(async (t: string | null) => {
        await setSessionToken(t);
        setToken(t);
    }, []);

    return { token, setToken: save, loading: token === undefined };
}

export function detectBrowserName(): string {
    if (Platform.OS !== "web" || typeof navigator === "undefined")
        return "Browser";
    const ua = navigator.userAgent;
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari")) return "Safari";
    return "Browser";
}

export function detectDeviceName(): string {
    if (Platform.OS !== "web" || typeof navigator === "undefined") {
        if (Platform.OS === "ios") return "iPhone";
        if (Platform.OS === "android") return "Android";
        return "Device";
    }
    const ua = navigator.userAgent;
    if (/Mac/.test(ua)) return "MacBook";
    if (/Windows/.test(ua)) return "Windows PC";
    if (/Linux/.test(ua)) return "Linux";
    if (/iPhone/.test(ua)) return "iPhone";
    if (/Android/.test(ua)) return "Android";
    return "Computer";
}