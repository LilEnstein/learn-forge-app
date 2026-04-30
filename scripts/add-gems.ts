import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] ?? "brolai1204@gmail.com";
  const amount = parseInt(process.argv[3] ?? "500", 10);

  const result = await prisma.userGamification.updateMany({
    where: { user: { email } },
    data: { gems: amount },
  });

  if (result.count === 0) {
    console.log(`No UserGamification row found for ${email}`);
  } else {
    console.log(`✓ Set gems = ${amount} for ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
