import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { issueReceipt, limitPayments, ownerProject, requirePaid, withPaymentLock } from "./core";
import { getMerchantStripe, connectState, retrieveMerchantAccount, merchantAccountParams } from "./stripe";
import { choice, EXTERNAL_TYPES, integer, manualData, MAX_AMOUNT, money, PaymentError, requestId, secureUrl, text } from "./validation";

export async function saveExternalOption(projectId: string, input: Record<string, unknown>) {
  const { user } = await ownerProject(projectId);
  await limitPayments(`settings:${user.id}`, 30);
  const data = { type: choice(input.type, EXTERNAL_TYPES, "provider"), label: text(input.label, "display label", 80), url: secureUrl(input.url), instructions: text(input.instructions, "instructions", 500, true) || null, enabled: input.enabled === true, sortOrder: integer(input.sortOrder, 0, 100) };
  return withPaymentLock(projectId, async (tx) => {
    await ownerProject(projectId, tx);
    if (input.id) {
      const updated = await tx.externalPaymentOption.updateMany({ where: { id: text(input.id, "payment option ID"), projectId }, data });
      if (!updated.count) throw new PaymentError("Payment option not found.");
    } else {
      if (await tx.externalPaymentOption.count({ where: { projectId } }) >= 10) throw new PaymentError("A project can have up to 10 external payment options.");
      await tx.externalPaymentOption.create({ data: { projectId, ...data } });
    }
  });
}

export async function savePaymentItem(projectId: string, input: Record<string, unknown>) {
  const { user } = await ownerProject(projectId);
  await requirePaid(user.id);
  await limitPayments(`settings:${user.id}`, 30);
  const type = choice(input.type, ["FIXED", "DEPOSIT", "CUSTOM_AMOUNT"] as const, "offer type");
  const minAmount = money(input.minAmount || "0.50", 50);
  const maxAmount = money(input.maxAmount || "10000", minAmount);
  const data = { name: text(input.name, "offer name", 100), description: text(input.description, "description", 500, true) || null, type, amount: type === "CUSTOM_AMOUNT" ? 0 : money(input.amount, 50), minAmount, maxAmount, enabled: input.enabled === true, currency: "usd" };
  await withPaymentLock(projectId, async (tx) => {
    await ownerProject(projectId, tx);
    if (input.id) {
      const result = await tx.paymentItem.updateMany({ where: { id: text(input.id, "offer ID"), projectId }, data });
      if (!result.count) throw new PaymentError("Payment offer not found.");
    } else {
      if (await tx.paymentItem.count({ where: { projectId } }) >= 30) throw new PaymentError("A project can have up to 30 offers.");
      await tx.paymentItem.create({ data: { projectId, ...data } });
    }
  });
}

export async function recordManualPayment(projectId: string, input: Record<string, unknown>) {
  const { user } = await ownerProject(projectId);
  await requirePaid(user.id);
  await limitPayments(`manual:${user.id}`, 30);
  const key = `manual:${requestId(input.requestId)}`;
  const { lineItems, ...data } = manualData(input);
  return withPaymentLock(projectId, async (tx) => {
    const { project } = await ownerProject(projectId, tx);
    const prior = await tx.customerPayment.findUnique({ where: { projectId_requestKey: { projectId, requestKey: key } } });
    if (prior) return prior.id;
    const payment = await tx.customerPayment.create({ data: { projectId, ...data, currency: "usd", paymentSource: "MANUAL_EXTERNAL", paymentStatus: "PAID", requestKey: key,
      businessName: project.businessName, businessEmail: project.email, businessPhone: project.phone, lineItems: { create: lineItems } } });
    await issueReceipt(tx, payment.id, projectId);
    return payment.id;
  });
}

export async function updateManualStatus(projectId: string, paymentId: string, input: Record<string, unknown>) {
  const { user } = await ownerProject(projectId);
  await limitPayments(`manual:${user.id}`, 30);
  const status = choice(input.status, ["PARTIALLY_REFUNDED", "REFUNDED", "VOIDED"] as const, "record status");
  await withPaymentLock(projectId, async (tx) => {
    await ownerProject(projectId, tx);
    const row = await tx.customerPayment.findFirst({ where: { id: paymentId, projectId, paymentSource: "MANUAL_EXTERNAL" } });
    if (!row || ["VOIDED", "REFUNDED"].includes(row.paymentStatus)) throw new PaymentError("This record cannot be changed.");
    const refundedAmount = status === "REFUNDED" ? row.totalAmount : status === "PARTIALLY_REFUNDED" ? money(input.refundedAmount, Math.max(1, row.refundedAmount), row.totalAmount - 1) : row.refundedAmount;
    await tx.customerPayment.update({ where: { id: row.id }, data: { paymentStatus: status, refundedAmount } });
  });
}

export async function refreshConnect(projectId: string) {
  const { user } = await ownerProject(projectId);
  await limitPayments(`connect:${user.id}`, 10);
  return withPaymentLock(projectId, async (tx) => {
    const { project } = await ownerProject(projectId, tx);
    const id = project.paymentSettings?.stripeConnectAccountId;
    if (!id) return;
    const account = await retrieveMerchantAccount(id);
    await tx.projectPaymentSettings.update({ where: { projectId }, data: connectState(account) });
  });
}

export async function onboardConnect(projectId: string) {
  const { user } = await ownerProject(projectId);
  await requirePaid(user.id);
  await limitPayments(`connect:${user.id}`, 10);
  // Persist the attempt before Stripe is called. An ambiguous old attempt fails
  // closed once Stripe's 24h idempotency retention can no longer be assumed.
  await prisma.projectPaymentSettings.upsert({ where: { projectId }, create: { projectId, accountAttemptAt: new Date() }, update: {} });
  const accountId = await withPaymentLock(projectId, async (tx) => {
    const { project } = await ownerProject(projectId, tx);
    const settings = project.paymentSettings!;
    let accountId = settings.stripeConnectAccountId;
    if (!accountId) {
      if (!settings.accountAttemptAt) {
        // Settings may predate Connect (manual receipt counter). Commit the
        // attempt independently before issuing a remote account creation.
        await prisma.projectPaymentSettings.update({ where: { projectId }, data: { accountAttemptAt: new Date() } });
      } else if (Date.now() - settings.accountAttemptAt.getTime() > 23 * 60 * 60 * 1000) throw new PaymentError("Stripe setup needs support review before retrying. Contact LaunchSite support.");
      const owner = await tx.user.findUnique({ where: { id: user.id }, select: { email: true } });
      const account = await getMerchantStripe().v2.core.accounts.create(merchantAccountParams(project, owner?.email), { idempotencyKey: `merchant-account-v2:${settings.id}` });
      accountId = account.id;
      await tx.projectPaymentSettings.update({ where: { projectId }, data: { stripeConnectAccountId: accountId } });
    }
    return accountId;
  });
  // Commit the account ID before retrieval or hosted-link creation can fail.
  // Retrying either step must reuse the remotely created account.
  await withPaymentLock(projectId, async (tx) => {
    await ownerProject(projectId, tx);
    const account = await retrieveMerchantAccount(accountId);
    await tx.projectPaymentSettings.update({ where: { projectId }, data: connectState(account) });
  });
  const path = `${getAppUrl()}/dashboard/projects/${encodeURIComponent(projectId)}/payments/connect`;
  const link = await getMerchantStripe().v2.core.accountLinks.create({ account: accountId, use_case: { type: "account_onboarding", account_onboarding: { configurations: ["merchant"], collection_options: { fields: "currently_due" }, return_url: `${path}?flow=return`, refresh_url: `${path}?flow=refresh` } } });
  return link.url;
}

export function merchantPublicUrl(project: { publicSlug: string | null; domain: { status: string; hostname: string } | null }) {
  return project.domain?.status === "ACTIVE" ? `https://${project.domain.hostname}` : `${getAppUrl()}/site/${encodeURIComponent(project.publicSlug!)}`;
}

export async function createMerchantCheckout(slug: string, itemId: string, input: { amount?: unknown; requestId: unknown }, origin: string | null) {
  const key = `checkout:${requestId(input.requestId)}`;
  const project = await prisma.websiteProject.findFirst({ where: { publicSlug: slug, isPublished: true }, include: { domain: true } });
  if (!project?.userId) throw new PaymentError("This business is not accepting payments.");
  const publicUrl = merchantPublicUrl(project);
  if (!origin || ![getAppUrl(), new URL(publicUrl).origin].includes(origin)) throw new PaymentError("Start your payment from the business website.");
  await requirePaid(project.userId);
  await limitPayments(`checkout-project:${project.id}`, 60);
  return withPaymentLock(project.id, async (tx) => {
    const fresh = await tx.websiteProject.findFirst({ where: { id: project.id, isPublished: true, publicSlug: slug }, include: { paymentSettings: true } });
    const item = await tx.paymentItem.findFirst({ where: { id: itemId, projectId: project.id, enabled: true } });
    const settings = fresh?.paymentSettings;
    if (!fresh?.userId || !item || !settings?.stripeConnectAccountId || settings.stripeConnectStatus !== "ACTIVE" || !settings.stripeChargesEnabled) throw new PaymentError("This offer is not available for payment.");
    await requirePaid(fresh.userId, tx);
    const accountId = settings.stripeConnectAccountId;
    const state = connectState(await retrieveMerchantAccount(accountId));
    if (state.stripeConnectStatus !== "ACTIVE" || !state.stripeChargesEnabled) throw new PaymentError("This business cannot accept card payments right now.");
    if (item.currency !== "usd") throw new PaymentError("Only USD is supported.");
    const amount = item.type === "CUSTOM_AMOUNT" ? money(input.amount, item.minAmount, item.maxAmount) : integer(item.amount, 50, MAX_AMOUNT);
    let payment = await tx.customerPayment.findUnique({ where: { projectId_requestKey: { projectId: project.id, requestKey: key } } });
    if (payment && (payment.totalAmount !== amount || payment.description !== item.name || payment.paymentSource !== "STRIPE")) throw new PaymentError("Reload the offer before starting another payment.");
    if (payment?.stripeCheckoutSessionId) {
      const session = await getMerchantStripe().checkout.sessions.retrieve(payment.stripeCheckoutSessionId, {}, { stripeAccount: accountId });
      if (session.status === "open" && session.url) return session.url;
      throw new PaymentError("This checkout has ended. Reload the business website to start again.");
    }
    const paymentId = payment?.id ?? randomUUID();
    if (!payment) {
      // Commit the pending snapshot before the API call. If the remote call or
      // later persistence fails, retries reuse the same immutable payment ID.
      payment = await prisma.customerPayment.create({ data: { id: paymentId, projectId: project.id, customerName: "Customer", description: item.name, businessName: fresh.businessName, businessEmail: fresh.email, businessPhone: fresh.phone,
        subtotal: amount, totalAmount: amount, currency: "usd", paymentMethod: "STRIPE", paymentSource: "STRIPE", stripeConnectAccountId: accountId, requestKey: key,
        lineItems: { create: [{ description: item.name, quantity: 1, unitAmount: amount, totalAmount: amount, position: 0 }] } } });
    }
    if (Date.now() - payment.createdAt.getTime() > 23 * 60 * 60 * 1000) throw new PaymentError("This checkout attempt has expired. Reload the website to start a new payment.");
    const returnPath = `${getAppUrl()}/payment`;
    const session = await getMerchantStripe().checkout.sessions.create({ mode: "payment", client_reference_id: paymentId,
      metadata: { launchsiteMerchantPaymentId: paymentId }, payment_intent_data: { metadata: { launchsiteMerchantPaymentId: paymentId } },
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: item.name } } }],
      success_url: `${returnPath}/success?site=${encodeURIComponent(slug)}`, cancel_url: `${returnPath}/cancel?site=${encodeURIComponent(slug)}`,
    }, { stripeAccount: accountId, idempotencyKey: `merchant-checkout:${paymentId}` });
    await tx.customerPayment.update({ where: { id: paymentId }, data: { stripeCheckoutSessionId: session.id } });
    if (!session.url) throw new PaymentError("Stripe could not open checkout. Try again.");
    return session.url;
  });
}

export async function publicPaymentOptions(slug: string) {
  const project = await prisma.websiteProject.findFirst({ where: { publicSlug: slug, isPublished: true }, select: { userId: true, paymentSettings: { select: { stripeConnectStatus: true, stripeChargesEnabled: true } }, externalPaymentOptions: { where: { enabled: true }, orderBy: { sortOrder: "asc" }, take: 10, select: { label: true, url: true, instructions: true } }, paymentItems: { where: { enabled: true }, take: 30, orderBy: { createdAt: "asc" }, select: { id: true, name: true, description: true, type: true, amount: true, minAmount: true, maxAmount: true } } } });
  if (!project) return { links: [], items: [] };
  const paid = project.userId && (await getUserEntitlements(project.userId)).canAcceptCustomerPayments;
  return { links: project.externalPaymentOptions.filter((link) => { try { secureUrl(link.url); return true; } catch { return false; } }), items: paid && project.paymentSettings?.stripeConnectStatus === "ACTIVE" && project.paymentSettings.stripeChargesEnabled ? project.paymentItems : [] };
}
