ALTER TABLE "BillingAccount" ADD COLUMN "featuredAddonActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingAccount" ADD COLUMN "featuredAddonPriceId" TEXT;
ALTER TABLE "BillingAccount" ADD COLUMN "featuredAddonCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "BillingAccount" ADD COLUMN "featuredAddonCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingAccount" ADD COLUMN "featuredAddonScheduleId" TEXT;
CREATE UNIQUE INDEX "BillingAccount_featuredAddonScheduleId_key" ON "BillingAccount"("featuredAddonScheduleId");
