import { describe, it, expect, vi, beforeEach } from "vitest"
import { NoAiKeyError, InvalidUserKeyError } from "@/lib/ai/errors"

// Mock Prisma — getDefaultKey (in lib/ai/keys.ts) uses findFirst.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userApiKey: {
      findFirst: vi.fn(),
    },
    userModelConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    poolKey: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/ai/crypto", () => ({
  decryptKey: vi.fn(() => "decrypted-api-key"),
}))

vi.mock("@/lib/ai/provider", () => ({
  createProvider: vi.fn(() => ({ getLLM: vi.fn(), getLLMStream: vi.fn(), getEmbeddingModel: vi.fn() })),
  validateProviderConfig: vi.fn(),
  getLLM: vi.fn(),
  getLLMStream: vi.fn(),
  getEmbeddingModel: vi.fn(),
}))

function makeKey(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    userId: "u1",
    name: "Test key",
    provider: "gemini",
    encryptedKey: "enc",
    iv: "iv",
    authTag: "tag",
    ollamaBaseUrl: null,
    isDefault: true,
    status: "active",
    quotaExceededAt: null,
    quotaResetHint: null,
    lastUsedAt: null,
    availableModels: null,
    modelsFetchedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("getProviderForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_PROVIDER = "gemini"
    process.env.GEMINI_API_KEY = "env-key"
  })

  it("returns user provider when active default key exists", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    const { createProvider } = await import("@/lib/ai/provider")
    vi.mocked(prisma.userApiKey.findFirst).mockResolvedValue(makeKey())
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await getProviderForUser("u1")
    expect(createProvider).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "gemini", apiKey: "decrypted-api-key" })
    )
  })

  it("throws InvalidUserKeyError when default key is invalid", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findFirst).mockResolvedValue(makeKey({ status: "invalid" }))
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(InvalidUserKeyError)
  })

  it("returns defaultProvider when no user record and env key present", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findFirst).mockResolvedValue(null)
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    const result = await getProviderForUser("u1")
    expect(result).toBeDefined()
  })

  it("throws NoAiKeyError when no user record and no env key", async () => {
    const { prisma } = await import("@/lib/db/prisma")
    vi.mocked(prisma.userApiKey.findFirst).mockResolvedValue(null)
    delete process.env.GEMINI_API_KEY
    const { getProviderForUser } = await import("@/lib/ai/user-provider")
    await expect(getProviderForUser("u1")).rejects.toThrow(NoAiKeyError)
  })
})
