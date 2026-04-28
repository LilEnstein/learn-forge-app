import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}

export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
