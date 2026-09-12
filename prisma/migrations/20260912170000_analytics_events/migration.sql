CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'LEAD_SUBMITTED');

CREATE TYPE "AnalyticsHostType" AS ENUM ('LAUNCHSITE_SLUG', 'CUSTOM_DOMAIN');

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "path" TEXT NOT NULL,
    "hostType" "AnalyticsHostType" NOT NULL,
    "source" TEXT,
    "referrer" TEXT,
    "visitorKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_projectId_createdAt_idx" ON "AnalyticsEvent"("projectId", "createdAt");
CREATE INDEX "AnalyticsEvent_projectId_type_createdAt_idx" ON "AnalyticsEvent"("projectId", "type", "createdAt");
CREATE INDEX "AnalyticsEvent_projectId_visitorKey_createdAt_idx" ON "AnalyticsEvent"("projectId", "visitorKey", "createdAt");

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
