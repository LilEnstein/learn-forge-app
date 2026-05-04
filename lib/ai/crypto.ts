import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getSecret(): Buffer {
  const hex = process.env.ENCRYPTION_SECRET
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_SECRET must be a 64-char hex string. Generate: openssl rand -hex 32")
  }
  return Buffer.from(hex, "hex")
}

export function encryptKey(plaintext: string): { encryptedKey: string; iv: string; authTag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getSecret(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptKey(encryptedKey: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv(ALGORITHM, getSecret(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(authTag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
