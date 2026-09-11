-- Adds optional factual source data without changing or removing existing project data.
ALTER TABLE "WebsiteProject"
  ADD COLUMN "businessStory" TEXT,
  ADD COLUMN "targetAudience" TEXT,
  ADD COLUMN "differentiators" TEXT,
  ADD COLUMN "customerPriorities" TEXT,
  ADD COLUMN "factualNotes" TEXT,
  ADD COLUMN "secondaryCallToAction" TEXT;

-- Existing services receive an empty factual description and remain valid.
ALTER TABLE "WebsiteService"
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notes" TEXT;
