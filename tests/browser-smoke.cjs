/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser verification. */
// Requires Node 22+ and Microsoft Edge. Run against a local production server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const base = process.env.SMOKE_APP_URL || "http://localhost:3000";
const slug = process.env.SMOKE_PUBLIC_SLUG || "red-river-garage-door-solutions";
const output = fs.mkdtempSync(path.join(os.tmpdir(), "launchsite-browser-"));
const port = 9337;
let browser;
let socket;

async function main() {
  browser = spawn(process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ["--headless", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(output, "profile")}`], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => { throw error; });
  let targets;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await delay(200); }
  }
  assert.ok(targets?.length, "Edge remote debugging must start");
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.reject(message.error); else task.resolve(message.result); }
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await command("Page.enable");
  const response = await fetch(`${base}/site/${slug}`);
  assert.equal(response.status, 200, "published customer site accessible signed out");
  const html = await response.text();
  assert.doesNotMatch(html, /href="\/(?:dashboard|admin|account|login|signup)"|factualNotes|cloudinaryPublicId|providerAccountId/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /rel="canonical"/);
  for (const width of [390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    await command("Page.navigate", { url: `${base}/site/${slug}` });
    await delay(1200);
    const { result } = await command("Runtime.evaluate", { expression: `JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.textContent,contact:!!document.querySelector('a[href^="tel:"]'),nav:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'))})`, returnByValue: true });
    const metrics = JSON.parse(result.value);
    assert.ok(metrics.heading);
    assert.ok(metrics.contact);
    assert.ok(metrics.scroll <= metrics.width, `no horizontal overflow at ${width}px`);
    assert.ok(!metrics.nav.some((href) => /^\/(admin|dashboard|account)/.test(href)));
    const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `public-${width}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`PASS signed-out public site: ${width}px`);
  }
  for (const route of ["/site/no-such-launchsite-smoke-address", "/site/INVALID-SLUG", "/site", "/site/tommy-s-landscaping-ac5da8ef", "/examples/no-such-example"]) {
    assert.equal((await fetch(base + route)).status, 404, route);
    console.log(`PASS 404: ${route}`);
  }
  for (const route of ["/examples", "/examples/summit-ridge-roofing-7ff2af99", "/examples/greenline-outdoor-services-2e650e2f"]) {
    assert.equal((await fetch(base + route)).status, 200, route);
    console.log(`PASS demo compatibility: ${route}`);
  }
  for (const route of ["/admin", "/dashboard"]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.equal(response.status, route === "/admin" ? 404 : 307, `${route} requires authentication`);
    console.log(`PASS authentication: ${route}`);
  }
  const pricingResponse = await fetch(`${base}/pricing`);
  assert.equal(pricingResponse.status, 200);
  const pricingHtml = await pricingResponse.text();
  assert.match(pricingHtml, /Starter/);
  assert.match(pricingHtml, /Business/);
  assert.doesNotMatch(pricingHtml, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|stripeCustomerId/);
  for (const width of [390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    await command("Page.navigate", { url: `${base}/pricing` });
    await delay(1000);
    const { result } = await command("Runtime.evaluate", { expression: `JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth,cards:document.querySelectorAll('article').length,signin:[...document.querySelectorAll('article a')].filter(a=>a.getAttribute('href')==='/login?callbackUrl=/pricing').length})`, returnByValue: true });
    const metrics = JSON.parse(result.value);
    assert.equal(metrics.overflow, false);
    assert.equal(metrics.cards, 3);
    assert.equal(metrics.signin, 2);
    const screenshot = await command("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(output, `pricing-${width}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`PASS pricing and signed-out plan flow: ${width}px`);
  }
  const billingResponse = await fetch(`${base}/account/billing?checkout=success`, { redirect: "manual" });
  assert.equal(billingResponse.status, 307);
  assert.equal(billingResponse.headers.get("location"), "/login?callbackUrl=/account/billing");
  const loginHtml = await (await fetch(`${base}/login?callbackUrl=/pricing`)).text();
  assert.match(loginHtml, /name="callbackUrl"[^>]*value="\/pricing"/);
  assert.equal((await fetch(`${base}/api/stripe/webhook`, { method: "POST", body: "{}" })).status, 400);
  assert.equal((await fetch(`${base}/api/stripe/webhook`)).status, 405);
  console.log("PASS billing authentication, sign-in return path, and unsigned webhook rejection");
  // Render synthetic content with the production CSS in the browser. This
  // covers layout/theme extremes without modifying the published customer's site.
  require("../scripts/register-typescript.cjs");
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { SiteRenderer } = require("../src/components/site-renderer.tsx");
  const { createWebsiteProject } = require("../src/lib/generate-site-content.ts");
  const { initialBusinessProfile, defaultSiteSettings, defaultThemeSettings, palettePresets } = require("../src/lib/website-types.ts");
  const cssUrls = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map((match) => match[1]);
  const css = (await Promise.all(cssUrls.map(async (url) => (await fetch(new URL(url, base))).text()))).join("\n");
  assert.ok(css.length > 1000, "production styles available for fixture rendering");
  const project = createWebsiteProject({ business: { ...initialBusinessProfile, businessName: "ExtraordinarilyLongBusinessName".repeat(5), category: "Home services", description: "Fixture description. ".repeat(20), serviceArea: "Tulsa", phone: "918-555-0100", email: "fixture@example.test", services: [{ id: "s", name: "Long service", description: "LongDescription".repeat(50), notes: "" }] }, visualStyle: "Modern", workSamples: [{ id: "p", mediaType: "IMAGE", mediaUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg", title: "Work sample", description: "Fixture image" }, { id: "v", mediaType: "VIDEO", mediaUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4", title: "Video sample", description: "Fixture video" }], testimonials: [{ id: "t", customerName: "Test customer", testimonialText: "A long testimonial. ".repeat(30) }] });
  for (const layoutFamily of ["Classic", "Conversion", "Showcase"]) {
    for (const palette of ["Minimal Neutral", "Premium Dark"]) {
      project.siteSettings = { ...defaultSiteSettings, layoutFamily, theme: { ...defaultThemeSettings, ...palettePresets[palette] } };
      const markup = renderToStaticMarkup(React.createElement(SiteRenderer, { project }));
      for (const width of [390, 768, 1440]) {
        await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        const { frameTree } = await command("Page.getFrameTree");
        await command("Page.setDocumentContent", { frameId: frameTree.frame.id, html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>` });
        await delay(100);
        const { result } = await command("Runtime.evaluate", { expression: `JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('h1,h2,h3,p,a,video')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.clientWidth>0).map(e=>e.tagName)})`, returnByValue: true });
        const metrics = JSON.parse(result.value);
        assert.equal(metrics.overflow, false, `${layoutFamily}/${palette}/${width} page overflow`);
        assert.deepEqual(metrics.clipped, [], `${layoutFamily}/${palette}/${width} clipped text/media`);
        if (width === 390) {
          const screenshot = await command("Page.captureScreenshot", { format: "png" });
          fs.writeFileSync(path.join(output, `${layoutFamily}-${palette.replaceAll(" ", "-")}.png`), Buffer.from(screenshot.data, "base64"));
        }
      }
      console.log(`PASS responsive fixture: ${layoutFamily}, ${palette}, 390/768/1440px`);
    }
  }
  console.log(`Screenshots: ${output}`);
  await command("Browser.close");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { socket?.close(); browser?.kill(); });
