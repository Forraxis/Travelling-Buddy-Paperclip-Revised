-- CreateTable
CREATE TABLE "RegulationSetVersion" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulationSetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegulationSetVersion_setId_effectiveDate_idx" ON "RegulationSetVersion"("setId", "effectiveDate");

-- CreateIndex
CREATE INDEX "RegulationSetVersion_createdById_idx" ON "RegulationSetVersion"("createdById");

-- AddForeignKey
ALTER TABLE "RegulationSetVersion" ADD CONSTRAINT "RegulationSetVersion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RegulationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulationSetVersion" ADD CONSTRAINT "RegulationSetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
