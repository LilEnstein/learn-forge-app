-- AlterTable: StreakRecord — rename lastActivityAt to lastActivityDate (String), frozenAt to String
ALTER TABLE "StreakRecord" RENAME COLUMN "lastActivityAt" TO "lastActivityDate";
ALTER TABLE "StreakRecord" ALTER COLUMN "lastActivityDate" TYPE TEXT USING "lastActivityDate"::TEXT;
ALTER TABLE "StreakRecord" ALTER COLUMN "frozenAt" TYPE TEXT USING "frozenAt"::TEXT;

-- AlterTable: DailyQuestProgress — change date from DateTime to String
ALTER TABLE "DailyQuestProgress" ALTER COLUMN "date" DROP DEFAULT;
ALTER TABLE "DailyQuestProgress" ALTER COLUMN "date" TYPE TEXT USING "date"::TEXT;

-- AlterTable: LessonProgress — add answeredIds and perfect columns
ALTER TABLE "LessonProgress" ADD COLUMN "answeredIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "LessonProgress" ADD COLUMN "perfect" BOOLEAN NOT NULL DEFAULT true;
