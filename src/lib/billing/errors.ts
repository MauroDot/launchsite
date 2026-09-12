export class BillingError extends Error {
  constructor(public readonly code: "BILLING_NOT_CONFIGURED" | "INVALID_PLAN" | "BILLING_UNAVAILABLE" | "BILLING_CUSTOMER_REQUIRED" | "PUBLISH_REQUIRES_PAID_PLAN" | "PUBLISHED_SITE_LIMIT_REACHED", message: string) {
    super(message);
    this.name = "BillingError";
  }
}
