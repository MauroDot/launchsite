CREATE TABLE "FeaturedBusiness" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "displayTitle" TEXT,
  "promotionalDescription" TEXT,
  "imageUrl" TEXT,
  "sortOrder" INTEGER,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeaturedBusiness_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeaturedBusiness_projectId_key" ON "FeaturedBusiness"("projectId");

ALTER TABLE "FeaturedBusiness"
  ADD CONSTRAINT "FeaturedBusiness_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
