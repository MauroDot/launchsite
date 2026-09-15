-- CreateEnum
CREATE TYPE "ConnectStatus" AS ENUM ('NOT_CONNECTED', 'ONBOARDING', 'PENDING', 'ACTIVE', 'RESTRICTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExternalPaymentType" AS ENUM ('PAYPAL', 'VENMO', 'CASH_APP', 'BANK_PAYMENT_LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentItemType" AS ENUM ('FIXED', 'DEPOSIT', 'CUSTOM_AMOUNT');

-- CreateEnum
CREATE TYPE "CustomerPaymentMethod" AS ENUM ('STRIPE', 'PAYPAL', 'VENMO', 'CASH_APP', 'BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerPaymentSource" AS ENUM ('STRIPE', 'MANUAL_EXTERNAL');

-- CreateEnum
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'FAILED');

-- CreateTable
CREATE TABLE "ProjectPaymentSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stripeConnectAccountId" TEXT,
    "stripeConnectStatus" "ConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "accountAttemptAt" TIMESTAMP(3),
    "receiptSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPaymentOption" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ExternalPaymentType" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "instructions" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPaymentOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "type" "PaymentItemType" NOT NULL DEFAULT 'FIXED',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minAmount" INTEGER NOT NULL DEFAULT 50,
    "maxAmount" INTEGER NOT NULL DEFAULT 1000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "description" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "businessPhone" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "paymentMethod" "CustomerPaymentMethod" NOT NULL,
    "paymentSource" "CustomerPaymentSource" NOT NULL,
    "paymentStatus" "CustomerPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "note" TEXT,
    "stripeConnectAccountId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeReceiptUrl" TEXT,
    "receiptNumber" TEXT,
    "receiptToken" TEXT,
    "receiptIssuedAt" TIMESTAMP(3),
    "requestKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLineItem" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PaymentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "PaymentRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRateLimit_pkey" PRIMARY KEY ("key")
);

-- Defense in depth for merchant money and source integrity (new tables only).
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_amounts_check" CHECK (
  "currency" = 'usd' AND "minAmount" >= 50 AND "maxAmount" >= "minAmount" AND "maxAmount" <= 1000000
  AND (("type" = 'CUSTOM_AMOUNT' AND "amount" = 0) OR ("type" <> 'CUSTOM_AMOUNT' AND "amount" BETWEEN 50 AND 1000000))
);
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_money_check" CHECK (
  "currency" = 'usd' AND "subtotal" > 0 AND "taxAmount" >= 0 AND "discountAmount" BETWEEN 0 AND "subtotal"
  AND "totalAmount" = "subtotal" + "taxAmount" - "discountAmount" AND "totalAmount" BETWEEN 1 AND 1000000
  AND "refundedAmount" BETWEEN 0 AND "totalAmount"
);
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_source_check" CHECK (
  ("paymentSource" = 'STRIPE' AND "paymentMethod" = 'STRIPE' AND "stripeConnectAccountId" IS NOT NULL)
  OR ("paymentSource" = 'MANUAL_EXTERNAL' AND "paymentMethod" <> 'STRIPE' AND "stripeConnectAccountId" IS NULL
    AND "stripeCheckoutSessionId" IS NULL AND "stripePaymentIntentId" IS NULL AND "stripeChargeId" IS NULL AND "stripeReceiptUrl" IS NULL)
);
ALTER TABLE "PaymentLineItem" ADD CONSTRAINT "PaymentLineItem_totals_check" CHECK (
  "quantity" BETWEEN 1 AND 1000 AND "unitAmount" BETWEEN 0 AND 1000000
  AND "totalAmount" = "quantity"::bigint * "unitAmount" AND "totalAmount" BETWEEN 0 AND 1000000
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentSettings_projectId_key" ON "ProjectPaymentSettings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentSettings_stripeConnectAccountId_key" ON "ProjectPaymentSettings"("stripeConnectAccountId");

-- CreateIndex
CREATE INDEX "ExternalPaymentOption_projectId_enabled_sortOrder_idx" ON "ExternalPaymentOption"("projectId", "enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "PaymentItem_projectId_enabled_idx" ON "PaymentItem"("projectId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_stripeCheckoutSessionId_key" ON "CustomerPayment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_stripePaymentIntentId_key" ON "CustomerPayment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_stripeChargeId_key" ON "CustomerPayment"("stripeChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_receiptToken_key" ON "CustomerPayment"("receiptToken");

-- CreateIndex
CREATE INDEX "CustomerPayment_projectId_paymentStatus_createdAt_idx" ON "CustomerPayment"("projectId", "paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPayment_projectId_paymentMethod_createdAt_idx" ON "CustomerPayment"("projectId", "paymentMethod", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_projectId_receiptNumber_key" ON "CustomerPayment"("projectId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_projectId_requestKey_key" ON "CustomerPayment"("projectId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLineItem_paymentId_position_key" ON "PaymentLineItem"("paymentId", "position");

-- CreateIndex
CREATE INDEX "PaymentRateLimit_resetAt_idx" ON "PaymentRateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "ProjectPaymentSettings" ADD CONSTRAINT "ProjectPaymentSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPaymentOption" ADD CONSTRAINT "ExternalPaymentOption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentItem" ADD CONSTRAINT "PaymentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLineItem" ADD CONSTRAINT "PaymentLineItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
