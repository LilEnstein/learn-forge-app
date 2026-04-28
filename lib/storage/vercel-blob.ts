import { put, del } from "@vercel/blob";

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const blob = await put(filename, buffer, { access: "public" });
  return blob.url;
}

export async function deleteFile(filePath: string): Promise<void> {
  await del(filePath).catch(() => {});
}

export async function readFile(filePath: string): Promise<Buffer> {
  const res = await fetch(filePath);
  if (!res.ok) throw new Error(`Failed to fetch blob: ${filePath}`);
  return Buffer.from(await res.arrayBuffer());
}
