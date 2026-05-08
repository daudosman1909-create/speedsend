import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { detectItemType } from "./theme";

export interface UploadResult {
    storageId: Id<"_storage">;
}

export async function uploadFileBlob(
    convex: ConvexReactClient,
    blob: Blob
): Promise<UploadResult> {
    const uploadUrl = await convex.mutation(api.items.generateUploadUrl, {});
    const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
    });
    if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
    }
    const json = await res.json();
    return { storageId: json.storageId as Id<"_storage"> };
}

export async function uploadFileFromUri(
    convex: ConvexReactClient,
    uri: string,
    mimeType: string
): Promise<UploadResult> {
    const fileResp = await fetch(uri);
    const blob = await fileResp.blob();
    const typedBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
    return await uploadFileBlob(convex, typedBlob);
}

export function fileToItemType(file: { name?: string; type?: string }) {
    return detectItemType(file);
}
