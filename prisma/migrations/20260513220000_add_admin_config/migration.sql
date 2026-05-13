-- CreateTable
CREATE TABLE "AdminConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "AdminConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AdminConfig_updatedById_idx" ON "AdminConfig"("updatedById");

-- AddForeignKey
ALTER TABLE "AdminConfig" ADD CONSTRAINT "AdminConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default trust-tier thresholds (these match the hardcoded constants in src/lib/trust-tier.ts)
-- Uses a system user placeholder; real seed is applied via prisma/seed.ts or a deploy script
