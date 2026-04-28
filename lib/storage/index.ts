import * as local from "./local";
import * as vercelBlob from "./vercel-blob";

const provider = process.env.STORAGE_PROVIDER ?? "local";

export const storage = provider === "vercel-blob" ? vercelBlob : local;
