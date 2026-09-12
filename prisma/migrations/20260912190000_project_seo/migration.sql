ALTER TABLE "WebsiteProject" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "WebsiteProject" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "WebsiteProject" ADD COLUMN "socialImageUrl" TEXT;
ALTER TABLE "WebsiteProject" ADD COLUMN "allowIndexing" BOOLEAN NOT NULL DEFAULT true;
