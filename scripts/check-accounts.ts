import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const users = await p.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tier: true,
      passwordHash: true,
      accounts: { select: { provider: true, providerAccountId: true, userId: true } },
    },
  })
  console.log("=== USERS ===")
  for (const u of users) {
    console.log(`${u.email} (id=${u.id})  role=${u.role}  tier=${u.tier}  hasPwd=${!!u.passwordHash}`)
    for (const a of u.accounts) {
      console.log(`  - ${a.provider}: ${a.providerAccountId}`)
    }
  }

  console.log("\n=== ALL ACCOUNTS ===")
  const allAccounts = await p.account.findMany({
    select: { provider: true, providerAccountId: true, userId: true },
    orderBy: [{ provider: "asc" }],
  })
  for (const a of allAccounts) {
    console.log(`${a.provider} | ${a.providerAccountId} → user ${a.userId}`)
  }
}

main().finally(() => p.$disconnect())
