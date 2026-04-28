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
