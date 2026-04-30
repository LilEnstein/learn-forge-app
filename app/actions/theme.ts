'use server'

import { requireSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function updateUserTheme(theme: string) {
  const session = await requireSession()
  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme },
  })
}
