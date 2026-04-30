import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
