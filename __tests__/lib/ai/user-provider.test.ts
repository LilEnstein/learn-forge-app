import { describe, it, expect, vi, beforeEach } from "vitest"
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors"

// Mock Prisma
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userApiKey: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock crypto
vi.mock("@/lib/ai/crypto", () => ({
  decryptKey: vi.fn(() => "decrypted-api-key"),
}))

// Mock createProvider
vi.mock("@/lib/ai/provider", () => ({
  createProvider: vi.fn(() => ({ getLLM: vi.fn(), getLLMStream: vi.fn(), getEmbeddingModel: vi.fn() })),
  validateProviderConfig: vi.fn(),
  getLLM: vi.fn(),
  getLLMStream: vi.fn(),
  getEmbeddingModel: vi.fn(),
}))

describe("getProviderForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_PROVIDER = "gemini"
    process.env.GEMINI_API_KEY = "env-key"
  })

  it("returns user provider when valid record exists", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    const { createProvider } = await import("@/lib/ai/provider")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
      id: "1", userId: "u1", provider: "gemini",
      encryptedKey: "enc", iv: "iv", authTag: "tag",
      ollamaBaseUrl: null, fastModel: null, capableModel: null,
      verifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    })
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await getProviderForUser("u1")
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", apiKey: "decrypted-api-key" }))
  })

  it("throws InvalidUserKeyError when record has no verifiedAt", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue({
      id: "1", userId: "u1", provider: "gemini",
      encryptedKey: "enc", iv: "iv", authTag: "tag",
      ollamaBaseUrl: null, fastModel: null, capableModel: null,
      verifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    })
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(InvalidUserKeyError)
  })

  it("returns defaultProvider when no user record and env key present", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null)
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    const result = await getProviderForUser("u1")
    expect(result).toBeDefined()
  })

  it("throws NoAiKeyError when no user record and no env key", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null)
    delete process.env.GEMINI_API_KEY
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(NoAiKeyError)
  })
})
