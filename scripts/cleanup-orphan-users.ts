/**
 * Delete users that have no OAuth accounts AND no password.
 * These are orphans created when an OAuth flow created the User row
 * but failed to create the Account row (e.g. before
 * allowDangerousEmailAccountLinking was enabled).
 *
 * Cascades through the small auto-created records (streak, gamification, etc.)
 * so the user can re-OAuth cleanly.
 */
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const orphans = await p.user.findMany({
    where: {
      passwordHash: null,
      accounts: { none: {} },
    },
    select: { id: true, email: true, createdAt: true },
  })

  if (orphans.length === 0) {
    console.log("No orphan users found.")
    return
  }

  console.log(`Found ${orphans.length} orphan user(s):`)
  for (const u of orphans) console.log(`  - ${u.email} (id=${u.id}, created=${u.createdAt.toISOString()})`)

  for (const u of orphans) {
    await p.$transaction([
      p.streakRecord.deleteMany({ where: { userId: u.id } }),
      p.userGamification.deleteMany({ where: { userId: u.id } }),
      p.dailyQuestProgress.deleteMany({ where: { userId: u.id } }),
      p.leagueEntry.deleteMany({ where: { userId: u.id } }),
      p.userApiKey.deleteMany({ where: { userId: u.id } }),
      p.session.deleteMany({ where: { userId: u.id } }),
      p.user.delete({ where: { id: u.id } }),
    ])
    console.log(`Deleted ${u.email}`)
  }
}

main().finally(() => p.$disconnect())
