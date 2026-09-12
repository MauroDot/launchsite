ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'QUALIFIED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'WON';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'LOST';

ALTER TABLE "Lead" ADD COLUMN "followUpAt" TIMESTAMP(3);

CREATE TABLE "LeadNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_projectId_status_createdAt_idx" ON "Lead"("projectId", "status", "createdAt");
CREATE INDEX "Lead_followUpAt_idx" ON "Lead"("followUpAt");
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX "LeadNote_userId_idx" ON "LeadNote"("userId");
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
