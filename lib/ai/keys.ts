import { prisma } from "@/lib/db/prisma"
import type { UserApiKey } from "@prisma/client"

const QUOTA_RESET_MS = 24 * 60 * 60 * 1000

export async function getActiveKeys(userId: string): Promise<UserApiKey[]> {
  return prisma.userApiKey.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { lastUsedAt: "desc" }],
  })
}

export async function getDefaultKey(userId: string): Promise<UserApiKey | null> {
  return prisma.userApiKey.findFirst({
    where: { userId, isDefault: true },
  })
}

export async function getKeyById(userId: string, keyId: string): Promise<UserApiKey | null> {
  const key = await prisma.userApiKey.findUnique({ where: { id: keyId } })
  if (!key || key.userId !== userId) return null
  return key
}

export async function setDefaultKey(userId: string, keyId: string): Promise<void> {
  await prisma.$transaction([
    prisma.userApiKey.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.userApiKey.update({ where: { id: keyId }, data: { isDefault: true } }),
  ])
}

export async function markQuotaExceeded(keyId: string): Promise<void> {
  const now = new Date()
  await prisma.userApiKey.update({
    where: { id: keyId },
    data: {
      status: "quota_exceeded",
      quotaExceededAt: now,
      quotaResetHint: new Date(now.getTime() + QUOTA_RESET_MS),
    },
  })
}

export async function markActive(keyId: string): Promise<void> {
  await prisma.userApiKey.update({
    where: { id: keyId },
    data: { status: "active", quotaExceededAt: null, quotaResetHint: null },
  })
}

export async function markInvalid(keyId: string): Promise<void> {
  await prisma.userApiKey.update({
    where: { id: keyId },
    data: { status: "invalid" },
  })
}

export async function touchLastUsed(keyId: string): Promise<void> {
  await prisma.userApiKey.update({
    where: { id: keyId },
    data: { lastUsedAt: new Date() },
  })
}

export async function getNextActiveKey(
  userId: string,
  excludeKeyId: string
): Promise<UserApiKey | null> {
  return prisma.userApiKey.findFirst({
    where: {
      userId,
      status: "active",
      id: { not: excludeKeyId },
    },
    orderBy: [{ isDefault: "desc" }, { lastUsedAt: "desc" }],
  })
}

// Removes a key. If the key was default and others remain, promotes the most
// recently-used remaining key to default.
export async function removeKey(userId: string, keyId: string): Promise<void> {
  const key = await prisma.userApiKey.findUnique({ where: { id: keyId } })
  if (!key || key.userId !== userId) return

  await prisma.$transaction(async (tx) => {
    await tx.userApiKey.delete({ where: { id: keyId } })
    if (!key.isDefault) return

    const next = await tx.userApiKey.findFirst({
      where: { userId },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    })
    if (next) {
      await tx.userApiKey.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
}
