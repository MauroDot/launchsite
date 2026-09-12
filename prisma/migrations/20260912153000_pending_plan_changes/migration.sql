ALTER TABLE "BillingAccount"
  ADD COLUMN "pendingPlan" "BillingPlan",
  ADD COLUMN "pendingPlanEffectiveAt" TIMESTAMP(3),
  ADD COLUMN "stripeSubscriptionScheduleId" TEXT;

CREATE UNIQUE INDEX "BillingAccount_stripeSubscriptionScheduleId_key" ON "BillingAccount"("stripeSubscriptionScheduleId");
