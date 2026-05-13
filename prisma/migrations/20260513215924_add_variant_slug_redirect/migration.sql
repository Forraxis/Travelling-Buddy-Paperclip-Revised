-- CreateTable
CREATE TABLE "VariantSlugRedirect" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantSlugRedirect_entityType_modelId_fromSlug_idx" ON "VariantSlugRedirect"("entityType", "modelId", "fromSlug");

-- CreateIndex
CREATE INDEX "VariantSlugRedirect_entityId_idx" ON "VariantSlugRedirect"("entityId");
