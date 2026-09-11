-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT');

-- CreateTable
CREATE TABLE "WebsiteProject" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "businessDescription" TEXT NOT NULL,
    "serviceArea" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "yearsInBusiness" INTEGER,
    "brandTone" TEXT NOT NULL,
    "primaryCallToAction" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "WebsiteProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "WebsiteService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteProject_slug_key" ON "WebsiteProject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteService_projectId_position_key" ON "WebsiteService"("projectId", "position");

-- AddForeignKey
ALTER TABLE "WebsiteService" ADD CONSTRAINT "WebsiteService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
