import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicSiteSeo, structuredBusinessData } from "./seo";
import type { PublicSite } from "./public-site";

function site(overrides: Partial<PublicSite> = {}): PublicSite {
  return {
    publicSlug: "summit-ridge-roofing",
    allowIndexing: true,
    business: { businessName: "Summit Ridge Roofing", category: "Roofing", description: "Local roofing experts.", phone: "555-0100", email: "hello@example.com", serviceArea: "Tulsa", callToAction: "Get in touch" },
    content: { tagline: "Built to last", heroHeading: "Roofing done right", heroDescription: "", services: [], about: "", benefits: [], contactPrompt: "" },
    siteSettings: {} as PublicSite["siteSettings"], workSamples: [], testimonials: [],
    ...overrides,
  };
}

describe("public SEO", () => {
  it("uses an active custom domain as the canonical origin", () => {
    const result = publicSiteSeo(site({ customDomain: "roofing.example.com", seoTitle: "Roofing Pros", seoDescription: "Trusted locally." }));
    assert.equal(result.canonicalUrl, "https://roofing.example.com");
    assert.equal(result.title, "Roofing Pros");
    assert.equal(result.description, "Trusted locally.");
  });

  it("falls back to the canonical app site URL and generated SEO", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://launchsite-two.vercel.app/";
    const result = publicSiteSeo(site({ generatedContent: { seo: { title: "Generated title", description: "Generated description" } } as PublicSite["generatedContent"] }));
    assert.equal(result.canonicalUrl, "https://launchsite-two.vercel.app/site/summit-ridge-roofing");
    assert.equal(result.title, "Generated title");
    assert.equal(result.robots, "index, follow");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous;
  });

  it("supports no-index projects and safe image fallbacks", () => {
    const result = publicSiteSeo(site({ allowIndexing: false, socialImageUrl: "javascript:alert(1)", workSamples: [{ id: "1", mediaType: "IMAGE", mediaUrl: "https://cdn.example.com/roof.jpg", title: "", description: "" }] }));
    assert.equal(result.robots, "noindex, nofollow");
    assert.equal(result.image, "https://cdn.example.com/roof.jpg");
  });

  it("gives a configured social image priority over work samples", () => {
    const result = publicSiteSeo(site({ socialImageUrl: "https://res.cloudinary.com/demo/image/upload/social.jpg", workSamples: [{ id: "1", mediaType: "IMAGE", mediaUrl: "https://cdn.example.com/work.jpg", title: "", description: "" }] }));
    assert.equal(result.image, "https://res.cloudinary.com/demo/image/upload/social.jpg");
  });

  it("produces valid business structured data without raw HTML", () => {
    const data = structuredBusinessData(site(), "https://launchsite-two.vercel.app/site/summit-ridge-roofing", null);
    assert.equal(data["@type"], "LocalBusiness");
    assert.equal(data.url, "https://launchsite-two.vercel.app/site/summit-ridge-roofing");
    assert.equal(JSON.parse(JSON.stringify(data)).name, "Summit Ridge Roofing");
  });
});
