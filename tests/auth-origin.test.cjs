/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hook loads TypeScript source. */
const assert = require("node:assert/strict");
const test = require("node:test");

test("Auth.js uses the canonical production origin despite a transient request deployment", () => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_APP_URL = "https://launchsite-two.vercel.app/";
  process.env.VERCEL_URL = "launchsite-m4cu4kfpw-mauro-dot.vercel.app";
  process.env.AUTH_SECRET = "test-secret";
  process.env.AUTH_GOOGLE_ID = "test-google-id";
  process.env.AUTH_GOOGLE_SECRET = "test-google-secret";
  delete process.env.AUTH_URL;

  const { configureAuthUrl } = require("../src/lib/app-url.ts");
  configureAuthUrl();

  assert.equal(process.env.AUTH_URL, "https://launchsite-two.vercel.app");
});
