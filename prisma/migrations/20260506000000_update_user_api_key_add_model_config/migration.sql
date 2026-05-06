-- Drop obsolete columns from UserApiKey (present in original migration, removed from schema)
ALTER TABLE "UserApiKey" DROP COLUMN IF EXISTS "fastModel";
ALTER TABLE "UserApiKey" DROP COLUMN IF EXISTS "capableModel";
ALTER TABLE "UserApiKey" DROP COLUMN IF EXISTS "verifiedAt";

-- Drop the old unique-per-user constraint (multi-key feature allows many keys per user)
DROP INDEX IF EXISTS "UserApiKey_userId_key";

-- Add new columns required by feature-10 multi-key manager
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'My API Key';
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "quotaExceededAt" TIMESTAMP(3);
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "quotaResetHint" TIMESTAMP(3);
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "availableModels" JSONB;
ALTER TABLE "UserApiKey" ADD COLUMN IF NOT EXISTS "modelsFetchedAt" TIMESTAMP(3);

-- Recreate indexes (non-unique)
CREATE INDEX IF NOT EXISTS "UserApiKey_userId_idx" ON "UserApiKey"("userId");
CREATE INDEX IF NOT EXISTS "UserApiKey_userId_isDefault_idx" ON "UserApiKey"("userId", "isDefault");

-- CreateTable UserModelConfig (per-user model selection for each task type)
CREATE TABLE IF NOT EXISTS "UserModelConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileProcessing" TEXT,
    "courseGen" TEXT,
    "companion" TEXT,
    "embedding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserModelConfig_userId_key" ON "UserModelConfig"("userId");

-- AddForeignKey
ALTER TABLE "UserModelConfig" ADD CONSTRAINT "UserModelConfig_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
