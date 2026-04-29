import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { boss: PgBoss | undefined };

let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (globalForBoss.boss) return globalForBoss.boss;

  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss(process.env.DATABASE_URL!);
      await boss.start();
      globalForBoss.boss = boss;
      return boss;
    })();
  }

  return bossPromise;
}

// Always creates queue before sending — createQueue is idempotent in pg-boss
export async function sendJob(queue: string, data: object): Promise<void> {
  const boss = await getBoss();
  await boss.createQueue(queue);
  await boss.send(queue, data);
}
