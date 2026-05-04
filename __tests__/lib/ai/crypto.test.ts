import { describe, it, expect, beforeEach, vi } from "vitest"

describe("crypto utils", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENCRYPTION_SECRET = "a".repeat(64)
  })

  it("round-trips a plaintext key", async () => {
    const { encryptKey, decryptKey } = await import("@/lib/ai/crypto")
    const { encryptedKey, iv, authTag } = encryptKey("AIzaSyABCDEF1234")
    expect(decryptKey(encryptedKey, iv, authTag)).toBe("AIzaSyABCDEF1234")
  })

  it("produces different ciphertext each call (random IV)", async () => {
    const { encryptKey } = await import("@/lib/ai/crypto")
    const a = encryptKey("same-key")
    const b = encryptKey("same-key")
    expect(a.encryptedKey).not.toBe(b.encryptedKey)
    expect(a.iv).not.toBe(b.iv)
  })

  it("throws when ENCRYPTION_SECRET is absent", async () => {
    delete process.env.ENCRYPTION_SECRET
    const { encryptKey } = await import("@/lib/ai/crypto")
    expect(() => encryptKey("test")).toThrow("ENCRYPTION_SECRET")
  })

  it("throws on tampered ciphertext", async () => {
    const { encryptKey, decryptKey } = await import("@/lib/ai/crypto")
    const { encryptedKey, iv, authTag } = encryptKey("original")
    const tampered = Buffer.from(encryptedKey, "base64")
    tampered[0] ^= 0xff
    expect(() => decryptKey(tampered.toString("base64"), iv, authTag)).toThrow()
  })
})
