/* eslint-disable @typescript-eslint/no-require-imports -- Install server doubles before loading the route. */
const assert = require("node:assert/strict");
const { test, beforeEach, afterEach } = require("node:test");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { createCloudinaryUploadForm, uploadFileError } = require("../src/lib/cloudinary-upload.ts");
let allowed, limited, logs;
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub("../src/lib/access.ts", { requireProjectAccess: async (id) => { if (!allowed || id === "other-project") throw new Error("NOT_FOUND"); } });
stub("../src/lib/rate-limit.ts", { rateLimit: () => ({ ok: !limited, retryAfter: 60 }), requestKey: () => "fixture", tooManyResponse: () => new Response(null, { status: 429 }) });
const { POST } = require("../src/app/api/projects/[id]/work-samples/upload-signature/route.ts");
const envKeys = ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
let previousEnv, originalInfo;
beforeEach(() => {
  allowed = true; limited = false; logs = [];
  previousEnv = envKeys.map((key) => process.env[key]);
  ["test-cloud", "test-key", "test-secret"].forEach((value, i) => { process.env[envKeys[i]] = value; });
  originalInfo = console.info; console.info = (...args) => logs.push(args);
});
afterEach(() => { console.info = originalInfo; envKeys.forEach((key, i) => { if (previousEnv[i] === undefined) delete process.env[key]; else process.env[key] = previousEnv[i]; }); });
const sign = (mediaType, id = "project-a", extra = {}) => POST(new Request("https://launchsite.test/sign", { method: "POST", body: JSON.stringify({ mediaType, ...extra }) }), { params: Promise.resolve({ id }) });
const digest = (text) => createHash("sha1").update(text + "test-secret").digest("hex");

for (const [mediaType, mime, formats, resource, max] of [
  ["IMAGE", "image/jpeg", "jpg,png,webp", "image", 10485760],
  ["VIDEO", "video/quicktime", "mp4,mov,webm", "video", 104857600],
]) {
  test(`${mediaType}: signature matches the exact Cloudinary multipart fields and timestamp`, async () => {
    const before = Math.floor(Date.now() / 1000);
    const response = await sign(mediaType);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const signed = await response.json();
    assert.equal(signed.resourceType, resource);
    assert.equal(signed.maxFileSize, max);
    assert.ok(signed.timestamp >= before && signed.timestamp <= Math.floor(Date.now() / 1000));
    const file = new File(["fixture"], "device-file", { type: mime });
    const form = createCloudinaryUploadForm(file, signed, mediaType);
    const params = Object.fromEntries([...form].filter(([key]) => !["file", "api_key", "signature"].includes(key)));
    assert.deepEqual(params, { allowed_formats: formats, folder: "launchsite/project-a", timestamp: String(signed.timestamp) });
    const expected = `allowed_formats=${formats}&folder=launchsite/project-a&timestamp=${signed.timestamp}`;
    assert.equal(signed.signature, digest(expected));
    assert.equal(form.get("signature"), digest(expected));
    assert.equal(form.get("api_key"), "test-key");
    assert.equal(form.get("file"), file);
    assert.equal(form.has("max_file_size"), false);
    assert.notEqual(signed.signature, digest(`allowed_formats=${formats}&folder=launchsite/project-a&max_file_size=${max}&timestamp=${signed.timestamp}`));
    assert.deepEqual(logs[0][1].signedParams, params);
    assert.doesNotMatch(JSON.stringify(logs), /test-secret|test-key/);
    assert.ok(!JSON.stringify(logs).includes(signed.signature));
    assert.ok(!JSON.stringify(signed).includes("test-secret"));
    assert.throws(() => createCloudinaryUploadForm(file, { ...signed, allowedFormats: undefined }, mediaType), /Could not prepare upload/);
  });
}
test("folder and timestamp come from the authorized project and server, never the request body", async () => {
  const signed = await (await sign("IMAGE", "project-b", { folder: "launchsite/other-project", timestamp: 1, allowedFormats: "svg" })).json();
  assert.equal(signed.folder, "launchsite/project-b");
  assert.notEqual(signed.timestamp, 1);
  assert.equal(signed.allowedFormats, "jpg,png,webp");
  assert.equal((await sign("IMAGE", "other-project")).status, 404);
});
test("authorization, rate limiting, media type validation, and safe configuration failures remain enforced", async () => {
  allowed = false; assert.equal((await sign("IMAGE")).status, 404);
  allowed = true; limited = true; assert.equal((await sign("IMAGE")).status, 429);
  limited = false; assert.equal((await sign("RAW")).status, 400);
  delete process.env.CLOUDINARY_API_SECRET;
  const response = await sign("IMAGE");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Media uploads are not configured." });
  assert.equal(logs.length, 0);
});
test("supported image/video formats and the exact 10 MB / 100 MB boundaries are preserved", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(uploadFileError({ type, size: 10485760 }, "IMAGE"), null);
    assert.match(uploadFileError({ type, size: 10485761 }, "IMAGE"), /10 MB/);
  }
  for (const type of ["video/mp4", "video/quicktime", "video/webm"]) {
    assert.equal(uploadFileError({ type, size: 104857600 }, "VIDEO"), null);
    assert.match(uploadFileError({ type, size: 104857601 }, "VIDEO"), /100 MB/);
  }
  for (const type of ["image/gif", "image/svg+xml", "image/heic", "application/pdf", "video/mp4"]) assert.ok(uploadFileError({ type, size: 1 }, "IMAGE"));
  for (const type of ["video/x-msvideo", "image/jpeg", "application/pdf"]) assert.ok(uploadFileError({ type, size: 1 }, "VIDEO"));
});
test("existing Cloudinary and external stored media URLs remain valid without new upload metadata", () => {
  const { validateProjectInput } = require("../src/lib/project-validation.ts");
  const { initialBusinessProfile } = require("../src/lib/website-types.ts");
  const urls = ["https://res.cloudinary.com/demo/image/upload/sample.jpg", "https://res.cloudinary.com/demo/video/upload/dog.mp4", "https://example.test/legacy.png"];
  const input = { business: { ...initialBusinessProfile, businessName: "Fixture", category: "Home services", description: "Professional home services in Tulsa.", serviceArea: "Tulsa", phone: "918-555-0100", email: "fixture@example.test", services: [{ id: "s", name: "Repairs", description: "", notes: "" }] }, visualStyle: "Modern", testimonials: [], workSamples: urls.map((mediaUrl, i) => ({ id: String(i), mediaType: i === 1 ? "VIDEO" : "IMAGE", mediaUrl, title: "Existing work", description: "", serviceCategory: "", locationNote: "" })) };
  const result = validateProjectInput(input);
  assert.equal(result.valid, true);
  assert.deepEqual(result.workSamples.map((sample) => sample.mediaUrl), urls);
});
test("both route consumers use the shared form builder and retain device capture without exposing provider errors", () => {
  for (const path of ["src/components/proof-source-editors.tsx", "src/components/seo-settings-form.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /createCloudinaryUploadForm\(file, signed,/);
    assert.doesNotMatch(source, /max_file_size|asset\.error|CLOUDINARY_API_SECRET|process\.env/);
  }
  assert.match(readFileSync("src/components/proof-source-editors.tsx", "utf8"), /capture="environment"/);
});
