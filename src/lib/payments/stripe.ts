import "server-only";
import Stripe from "stripe";
import { email, PaymentError, text } from "./validation";
let client: Stripe | undefined;
// Account, onboarding, and payment requests use the installed SDK's stable API version.
export const ACCOUNT_INCLUDES: Stripe.V2.Core.AccountRetrieveParams.Include[] = ["configuration.merchant", "requirements", "defaults"];
export function merchantAccountParams(project: { businessName: string; email: string | null }, ownerEmail: string | null | undefined): Stripe.V2.Core.AccountCreateParams {
  const validEmail = (value: unknown) => { try { return email(value); } catch { return null; } };
  const contactEmail = validEmail(project.email) || validEmail(ownerEmail);
  if (!contactEmail) throw new PaymentError("Add a valid business email before connecting Stripe.");
  return {
    display_name: text(project.businessName, "business name", 200),
    contact_email: contactEmail,
    identity: { country: "us" },
    dashboard: "full",
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
    // Merchant configuration automatically requests stripe_balance.payouts.
    // No recipient/transfers or customer/subscription configuration is needed.
    defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
  };
}
export async function retrieveMerchantAccount(id: string, context?: Stripe.RequestOptions["stripeContext"], stripe = getMerchantStripe()) {
  const account = await stripe.v2.core.accounts.retrieve(id, { include: [...ACCOUNT_INCLUDES] }, context ? { stripeContext: context } : {});
  if (account.id !== id) throw new Error("Connect account mismatch");
  return account;
}
// Dedicated Connect platform authentication; never fall back to SaaS billing.
// No customers, subscriptions, prices, events, or BillingAccount writes cross this boundary.
export function getMerchantStripe() {
  const key = process.env.STRIPE_CONNECT_SECRET_KEY?.trim();
  if (!key) throw new PaymentError("Card payments are not configured yet.");
  return client ??= new Stripe(key, { apiVersion: "2026-08-26.dahlia", maxNetworkRetries: 1, timeout: 5000 });
}
export function connectState(account: Stripe.V2.Core.Account) {
  const merchant = account.configuration?.merchant;
  const cards = merchant?.capabilities?.card_payments;
  const payouts = merchant?.capabilities?.stripe_balance?.payouts;
  const responsibilities = account.defaults?.responsibilities;
  const compatible = account.dashboard === "full" && responsibilities?.fees_collector === "stripe" && responsibilities?.losses_collector === "stripe";
  const entries = account.requirements?.entries;
  const dueFromUser = entries?.some((entry) => entry.awaiting_action_from === "user" && ["currently_due", "past_due"].includes(entry.minimum_deadline.status));
  // This retained field now means no currently/past-due information awaits the
  // merchant. It is not Stripe's former details_submitted flag, nor KYC proof.
  const detailsSubmitted = Boolean(merchant && Array.isArray(entries) && !dueFromUser);
  const chargesEnabled = Boolean(!account.closed && compatible && cards?.status === "active");
  const status = account.closed || cards?.status === "unsupported" ? "DISABLED"
    : merchant && !compatible || cards?.status === "restricted" ? "RESTRICTED"
    : chargesEnabled ? "ACTIVE"
    : dueFromUser || !merchant ? "ONBOARDING" : "PENDING";
  return { stripeConnectStatus: status as "DISABLED" | "RESTRICTED" | "ONBOARDING" | "ACTIVE" | "PENDING", stripeChargesEnabled: chargesEnabled, stripePayoutsEnabled: Boolean(!account.closed && compatible && payouts?.status === "active"), stripeDetailsSubmitted: detailsSubmitted };
}
