-- CreateTable
CREATE TABLE "SetupVersion" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "stateSnapshot" JSONB NOT NULL,
    "resultSummary" JSONB,
    "isWeighedBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetupVersion_setupId_idx" ON "SetupVersion"("setupId");

-- AddForeignKey
ALTER TABLE "SetupVersion" ADD CONSTRAINT "SetupVersion_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
