-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccessoryStatus" AS ENUM ('ACTIVE', 'DISCONTINUED', 'PLACEHOLDER');

-- CreateTable
CREATE TABLE "AccessoryBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPartner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "iconName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT[],
    "priceMin" DECIMAL(10,2),
    "priceMax" DECIMAL(10,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'AUD',
    "affiliateUrl" TEXT,
    "status" "AccessoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "market" "Market" NOT NULL DEFAULT 'AU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryBrand_name_key" ON "AccessoryBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryBrand_slug_key" ON "AccessoryBrand"("slug");

-- CreateIndex
CREATE INDEX "AccessoryBrand_slug_idx" ON "AccessoryBrand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryCategory_name_key" ON "AccessoryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryCategory_slug_key" ON "AccessoryCategory"("slug");

-- CreateIndex
CREATE INDEX "AccessoryCategory_slug_idx" ON "AccessoryCategory"("slug");

-- CreateIndex
CREATE INDEX "AccessoryCategory_parentId_idx" ON "AccessoryCategory"("parentId");

-- CreateIndex
CREATE INDEX "Accessory_slug_idx" ON "Accessory"("slug");

-- CreateIndex
CREATE INDEX "Accessory_brandId_idx" ON "Accessory"("brandId");

-- CreateIndex
CREATE INDEX "Accessory_categoryId_idx" ON "Accessory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Accessory_brandId_slug_key" ON "Accessory"("brandId", "slug");

-- AddForeignKey
ALTER TABLE "AccessoryCategory" ADD CONSTRAINT "AccessoryCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccessoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "AccessoryBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccessoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
