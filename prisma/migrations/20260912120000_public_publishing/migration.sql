-- Add the MVP publishing state without changing existing project or demo data.
ALTER TABLE "WebsiteProject" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebsiteProject" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "WebsiteProject" ADD COLUMN "lastPublishedAt" TIMESTAMP(3);
ALTER TABLE "WebsiteProject" ADD COLUMN "publicSlug" TEXT;

CREATE UNIQUE INDEX "WebsiteProject_publicSlug_key" ON "WebsiteProject"("publicSlug");
