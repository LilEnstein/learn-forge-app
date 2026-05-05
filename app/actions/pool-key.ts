"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { encryptKey, decryptKey } from "@/lib/ai/crypto"

const REVALIDATE = "/admin/keys"

const AddKeySchema = z.object({
  provider: z.enum(["gemini", "openai", "groq", "cerebras"]),
  apiKey: z.string().min(10),
  label: z.string().optional(),
  dailyLimit: z.coerce.number().int().min(1).max(100_000).default(1000),
  priority: z.coerce.number().int().min(0).max(999).default(0),
})

function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••••"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

export type PoolKeyRow = {
  id: string
  provider: string
  label: string | null
  maskedKey: string
  dailyLimit: number
  dailyUsed: number
  isActive: boolean
  priority: number
  createdAt: Date
}

export async function listPoolKeys(): Promise<PoolKeyRow[]> {
  await requireAdmin()
  const keys = await prisma.poolKey.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  })
  return keys.map((k) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    maskedKey: maskKey(decryptKey(k.encryptedKey, k.iv, k.authTag)),
    dailyLimit: k.dailyLimit,
    dailyUsed: k.dailyUsed,
    isActive: k.isActive,
    priority: k.priority,
    createdAt: k.createdAt,
  }))
}

export async function addPoolKey(
  _: unknown,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  await requireAdmin()

  const parsed = AddKeySchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
    label: formData.get("label") || undefined,
    dailyLimit: formData.get("dailyLimit"),
    priority: formData.get("priority"),
  })
  if (!parsed.success) return { error: "Invalid input" }

  const encrypted = encryptKey(parsed.data.apiKey)
  await prisma.poolKey.create({
    data: {
      provider: parsed.data.provider,
      label: parsed.data.label ?? null,
      ...encrypted,
      dailyLimit: parsed.data.dailyLimit,
      priority: parsed.data.priority,
    },
  })

  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function togglePoolKey(id: string): Promise<void> {
  await requireAdmin()
  const key = await prisma.poolKey.findUnique({ where: { id }, select: { isActive: true } })
  if (!key) return
  await prisma.poolKey.update({ where: { id }, data: { isActive: !key.isActive } })
  revalidatePath(REVALIDATE)
}

export async function deletePoolKey(id: string): Promise<void> {
  await requireAdmin()
  await prisma.poolKey.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}
