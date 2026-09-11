ALTER TABLE "WebsiteProject" ADD COLUMN "siteSettings" JSONB;
ALTER TABLE "WebsiteProject" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebsiteProject" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebsiteProject" ADD COLUMN "demoTitle" TEXT;
ALTER TABLE "WebsiteProject" ADD COLUMN "demoDescription" TEXT;
ALTER TABLE "WebsiteProject" ADD COLUMN "demoSortOrder" INTEGER;
