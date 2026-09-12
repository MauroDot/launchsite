// Public application plan information. Stripe IDs and secrets never live here.
export const plans = {
  FREE: { name: "Free", monthlyPrice: 0, maxPublishedSites: 0, description: "Build your website at your own pace.", features: ["Create websites", "AI-assisted content", "Edit and preview", "Upgrade when you are ready to publish"] },
  STARTER: { name: "Starter", monthlyPrice: 19, maxPublishedSites: 1, description: "Put your business online.", features: ["Publish one website", "Hosting and a public LaunchSite URL", "Website editing", "AI content tools"] },
  BUSINESS: { name: "Business", monthlyPrice: 39, maxPublishedSites: 3, description: "Room for more of your business.", features: ["Publish up to three websites", "Hosting and public LaunchSite URLs", "Website editing", "AI content tools"] },
} as const;

export type Plan = keyof typeof plans;
export type PaidPlan = Exclude<Plan, "FREE">;
export function isPaidPlan(value: unknown): value is PaidPlan { return value === "STARTER" || value === "BUSINESS"; }
