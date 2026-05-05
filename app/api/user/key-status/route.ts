import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { hasEnvKey } from "@/lib/ai/user-provider"

export const dynamic = "force-dynamic"

export interface KeyStatusResponse {
  activeKey: {
    id: string
    name: string
    provider: string
    status: "active" | "quota_exceeded" | "invalid"
    quotaResetHint: string | null
  } | null
  models: {
    fileProcessing: string | null
    companion: string | null
  }
  hasEnvFallback: boolean
}

export async function GET() {
  const session = await requireSession()
  const userId = session.user.id as string

  const [defaultKey, modelConfig] = await Promise.all([
    prisma.userApiKey.findFirst({
      where: { userId, isDefault: true },
      select: { id: true, name: true, provider: true, status: true, quotaResetHint: true },
    }),
    prisma.userModelConfig.findUnique({
      where: { userId },
      select: { fileProcessing: true, companion: true },
    }),
  ])

  const envProvider = process.env.AI_PROVIDER ?? "gemini"
  const body: KeyStatusResponse = {
    activeKey: defaultKey
      ? {
          id: defaultKey.id,
          name: defaultKey.name,
          provider: defaultKey.provider,
          status: defaultKey.status as "active" | "quota_exceeded" | "invalid",
          quotaResetHint: defaultKey.quotaResetHint?.toISOString() ?? null,
        }
      : null,
    models: {
      fileProcessing: modelConfig?.fileProcessing ?? null,
      companion: modelConfig?.companion ?? null,
    },
    hasEnvFallback: hasEnvKey(envProvider),
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
  })
}
