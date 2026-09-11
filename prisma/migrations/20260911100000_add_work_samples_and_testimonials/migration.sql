CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "WebsiteWorkSample" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "serviceCategory" TEXT,
  "locationNote" TEXT,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteWorkSample_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteWorkSample_projectId_position_key" UNIQUE ("projectId", "position"),
  CONSTRAINT "WebsiteWorkSample_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WebsiteTestimonial" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "testimonialText" TEXT NOT NULL,
  "serviceType" TEXT,
  "locationNote" TEXT,
  "rating" INTEGER,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteTestimonial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteTestimonial_projectId_position_key" UNIQUE ("projectId", "position"),
  CONSTRAINT "WebsiteTestimonial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
