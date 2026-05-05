"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { encryptKey, decryptKey } from "@/lib/ai/crypto"
import { createProvider } from "@/lib/ai/provider"

const VERIFY_TIMEOUT_MS = 10_000

const SaveKeySchema = z.object({
  provider: z.enum(["gemini", "openai", "groq", "cerebras", "ollama", "openai-compat"]),
  apiKey: z.string().min(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
  openAiCompatBaseUrl: z.string().url().optional(),
  fastModel: z.string().optional(),
  capableModel: z.string().optional(),
})

type SaveKeyInput = z.infer<typeof SaveKeySchema>

function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••••"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

// Cheapest model per provider for verification only
const VERIFY_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  groq: "llama-3.1-8b-instant",
  cerebras: "llama3.1-8b",
}

async function verifyKey(input: SaveKeyInput): Promise<void> {
  const { provider, apiKey, ollamaBaseUrl, openAiCompatBaseUrl } = input

  if (provider === "ollama") {
    const baseUrl = ollamaBaseUrl ?? "http://localhost:11434"
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal })
      if (!res.ok) throw Object.assign(new Error("Ollama unreachable"), { status: res.status })
    } catch (err: any) {
      if (err.name === "AbortError") throw Object.assign(new Error("timeout"), { isTimeout: true })
      throw err
    } finally {
      clearTimeout(timer)
    }
    return
  }

  const verifyProvider = createProvider({
    provider,
    apiKey,
    openAiCompatBaseUrl,
    capableModel: VERIFY_MODELS[provider] ?? input.capableModel ?? input.fastModel,
  })
  const llm = verifyProvider.getLLM()

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error("timeout"), { isTimeout: true })), VERIFY_TIMEOUT_MS)
  )

  try {
    await Promise.race([llm([{ role: "user", content: "Hi" }]), timeoutPromise])
  } catch (err: any) {
    if (err.isTimeout) throw err
    // Gemini returns 400 for invalid API key; OpenAI returns 401; some SDKs put status on response
    const status = err.status ?? err.statusCode ?? err.response?.status ?? 0
    if (status === 400 || status === 401 || status === 403) {
      throw Object.assign(new Error("invalid_key"), { isInvalidKey: true })
    }
    if (status === 404) {
      throw Object.assign(new Error("model_not_found"), { isModelNotFound: true })
    }
    if (status === 429) {
      throw Object.assign(new Error("rate_limited"), { isRateLimited: true })
    }
    // Last resort: check error message for key-related keywords
    const msg = (err.message ?? "").toLowerCase()
    if (msg.includes("api key") || msg.includes("invalid key") || msg.includes("unauthorized")) {
      throw Object.assign(new Error("invalid_key"), { isInvalidKey: true })
    }
    throw err
  }
}

function verifyErrorMessage(err: any): string {
  if (err.isTimeout) return "Không thể kết nối đến provider. Kiểm tra mạng và thử lại."
  if (err.isInvalidKey) return "API key không hợp lệ. Kiểm tra lại trong provider dashboard."
  if (err.isRateLimited) return "Key hợp lệ nhưng đang bị rate limit. Thử lại sau ít phút."
  if (err.isModelNotFound) return "Model xác minh không còn khả dụng. Thử chọn model khác trong Advanced."
  console.error("[api-key verify] unexpected error:", err)
  return `Lỗi xác minh key: ${err?.message ?? "unknown"}`
}

export async function saveUserApiKey(
  input: SaveKeyInput
): Promise<{ maskedKey: string; provider: string; verifiedAt: Date } | { error: string }> {
  const session = await requireSession()
  const userId = session.user.id as string

  const parsed = SaveKeySchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  try {
    await verifyKey(parsed.data)
  } catch (err) {
    return { error: verifyErrorMessage(err) }
  }

  const plainKey = parsed.data.apiKey ?? ""
  const encrypted = plainKey ? encryptKey(plainKey) : { encryptedKey: "", iv: "", authTag: "" }
  const verifiedAt = new Date()

  await prisma.userApiKey.upsert({
    where: { userId },
    create: {
      userId,
      provider: parsed.data.provider,
      ...encrypted,
      ollamaBaseUrl: parsed.data.ollamaBaseUrl ?? null,
      fastModel: parsed.data.fastModel ?? null,
      capableModel: parsed.data.capableModel ?? null,
      verifiedAt,
    },
    update: {
      provider: parsed.data.provider,
      ...encrypted,
      ollamaBaseUrl: parsed.data.ollamaBaseUrl ?? null,
      fastModel: parsed.data.fastModel ?? null,
      capableModel: parsed.data.capableModel ?? null,
      verifiedAt,
    },
  })

  revalidatePath("/app/settings")
  const displayValue = plainKey || parsed.data.ollamaBaseUrl || (parsed.data.provider === "ollama" ? "http://localhost:11434" : "")
  return { maskedKey: maskKey(displayValue), provider: parsed.data.provider, verifiedAt }
}

export async function deleteUserApiKey(): Promise<void> {
  const session = await requireSession()
  await prisma.userApiKey.deleteMany({ where: { userId: session.user.id as string } })
  revalidatePath("/app/settings")
}

export async function getUserApiKeyStatus(): Promise<{
  provider: string
  maskedKey: string
  verifiedAt: Date
} | null> {
  const session = await requireSession()
  const record = await prisma.userApiKey.findUnique({ where: { userId: session.user.id as string } })
  if (!record || !record.verifiedAt) return null

  const plainKey = record.encryptedKey
    ? decryptKey(record.encryptedKey, record.iv, record.authTag)
    : (record.ollamaBaseUrl ?? (record.provider === "ollama" ? "http://localhost:11434" : ""))

  return {
    provider: record.provider,
    maskedKey: maskKey(plainKey),
    verifiedAt: record.verifiedAt,
  }
}
