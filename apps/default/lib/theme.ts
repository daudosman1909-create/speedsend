import { Platform } from "react-native";

const darkColors = {
    bg: "#101013",
    panel: "#17171b",
    card: "#1e1e23",
    cardElevated: "#25252b",
    border: "#2f2f36",
    borderSoft: "#24242a",
    text: "#f5f5f7",
    textPrimary: "#f5f5f7",
    textSecondary: "#b4b4bc",
    textMuted: "#7d7d86",
    textTertiary: "#7d7d86",
    accent: "#f5f5f7",
    accentBright: "#ffffff",
    accentSoft: "rgba(255,255,255,0.08)",
    accentBorder: "rgba(255,255,255,0.18)",
    accentForeground: "#101013",
    success: "#f5f5f7",
    danger: "#ff5e6c",
    warning: "#f5a524",
};

const webColors = {
    bg: "var(--bg, #101013)",
    panel: "var(--panel, #17171b)",
    card: "var(--card, #1e1e23)",
    cardElevated: "var(--cardElevated, #25252b)",
    border: "var(--border, #2f2f36)",
    borderSoft: "var(--borderSoft, #24242a)",
    text: "var(--text, #f5f5f7)",
    textPrimary: "var(--textPrimary, #f5f5f7)",
    textSecondary: "var(--textSecondary, #b4b4bc)",
    textMuted: "var(--textMuted, #7d7d86)",
    textTertiary: "var(--textTertiary, #7d7d86)",
    accent: "var(--accent, #f5f5f7)",
    accentBright: "var(--accentBright, #ffffff)",
    accentSoft: "var(--accentSoft, rgba(255,255,255,0.08))",
    accentBorder: "var(--accentBorder, rgba(255,255,255,0.18))",
    accentForeground: "var(--accentForeground, #101013)",
    success: "var(--success, #f5f5f7)",
    danger: "var(--danger, #ff5e6c)",
    warning: "var(--warning, #f5a524)",
};

export const theme = {
    ...(Platform.OS === "web" ? webColors : darkColors),
    mono: "ui-monospace, Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', monospace",
};

export const radii = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    pill: 999,
};

export function formatBytes(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function detectItemType(
    file: { name?: string; type?: string }
): "image" | "video" | "audio" | "pdf" | "document" | "file" {
    const mime = (file.type ?? "").toLowerCase();
    const name = (file.name ?? "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (
        mime.includes("word") ||
        mime.includes("document") ||
        mime.includes("text") ||
        name.match(/\.(doc|docx|txt|md|rtf|csv|xls|xlsx|ppt|pptx)$/i)
    )
        return "document";
    return "file";
}

export function isLikelyUrl(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.includes(" ") || trimmed.includes("\n")) return false;
    return /^(https?:\/\/|www\.)/i.test(trimmed);
}
