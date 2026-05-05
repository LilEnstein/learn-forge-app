import { prisma } from "../lib/db/prisma"

async function main() {
  // Set every existing key as the default for its user.
  // Pre-Feature-10 there was at most one key per user (userId was @unique),
  // so this safely promotes each user's lone key to default.
  const result = await prisma.$executeRaw`UPDATE "UserApiKey" SET "isDefault" = true WHERE "isDefault" = false`
  console.log(`Backfilled ${result} UserApiKey row(s) to isDefault = true`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
