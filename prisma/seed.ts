import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Pre-seed known accounts so role/tier are set before first sign-in
  const sangUser = await prisma.user.upsert({
    where: { email: "nguyenanhsangai@gmail.com" },
    update: {},
    create: {
      email: "nguyenanhsangai@gmail.com",
      name: "Nguyen Anh Sang",
      role: "user",
      tier: "free",
    },
  });
  // Ensure gamification + streak rows exist (normally created by createUser event)
  await prisma.$transaction([
    prisma.userGamification.upsert({
      where: { userId: sangUser.id },
      update: {},
      create: { userId: sangUser.id },
    }),
    prisma.streakRecord.upsert({
      where: { userId: sangUser.id },
      update: {},
      create: { userId: sangUser.id },
    }),
  ]);
  console.log(`Upserted user: ${sangUser.email}`);

  await prisma.dailyQuest.deleteMany();

  await prisma.dailyQuest.createMany({
    data: [
      {
        type: "complete_lesson",
        title: "Lesson Learner",
        description: "Complete 1 lesson today",
        target: 1,
        gemReward: 20,
        xpReward: 0,
      },
      {
        type: "earn_xp",
        title: "XP Hunter",
        description: "Earn 50 XP today",
        target: 50,
        gemReward: 25,
        xpReward: 0,
      },
      {
        type: "perfect_score",
        title: "Perfectionist",
        description: "Complete a lesson with no mistakes",
        target: 1,
        gemReward: 30,
        xpReward: 0,
      },
    ],
  });

  console.log("Seeded 3 daily quests");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
