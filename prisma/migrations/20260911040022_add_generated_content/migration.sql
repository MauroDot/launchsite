-- AlterTable
ALTER TABLE "WebsiteProject" ADD COLUMN     "contentGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "generatedContent" JSONB;
