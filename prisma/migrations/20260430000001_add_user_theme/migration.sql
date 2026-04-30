-- AlterTable: User — add theme field for dark mode persistence
ALTER TABLE "User" ADD COLUMN "theme" TEXT DEFAULT 'system';
