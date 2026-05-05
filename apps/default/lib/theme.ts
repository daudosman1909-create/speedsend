export const theme = {
    bg: "#111114",
    panel: "#18181c",
    card: "#202027",
    cardElevated: "#26262e",
    border: "#2d2d35",
    borderSoft: "#23232a",
    text: "#f5f5f7",
    textSecondary: "#9b9ba3",
    textMuted: "#6b6b75",
    accent: "#ff5ca8",
    accentBright: "#ff7ab8",
    accentSoft: "rgba(255,92,168,0.12)",
    accentBorder: "rgba(255,92,168,0.35)",
    success: "#ff5ca8",
    danger: "#ff5e6c",
    warning: "#f5a524",
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
