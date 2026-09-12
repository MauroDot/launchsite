/* eslint-disable @typescript-eslint/no-require-imports -- standalone diagnostic script. */
require("dotenv").config();
const { Resend } = require("resend");

const recipient = process.argv[2]?.trim();
const sender = process.env.LEAD_NOTIFICATION_FROM?.trim();
const key = process.env.RESEND_API_KEY?.trim();
if (!recipient) { console.error("Usage: node scripts/test-lead-email.cjs recipient@example.com"); process.exitCode = 1; return; }
if (!sender || !key) { console.error(JSON.stringify({ sender: sender || null, recipient, error: "LEAD_NOTIFICATION_FROM and RESEND_API_KEY are required." }, null, 2)); process.exitCode = 1; return; }
(async () => {
  const result = await new Resend(key).emails.send({ from: sender, to: [recipient], subject: "LaunchSite lead email diagnostic", html: "<p>This is a LaunchSite Resend delivery diagnostic.</p>" });
  if (result.error || !result.data?.id) { const error = result.error || { message: "Resend did not return an accepted email id." }; console.error(JSON.stringify({ sender, recipient, errorType: error.name || "ResendError", errorCode: error.code || null, errorMessage: error.message || "Email rejected." }, null, 2)); process.exitCode = 1; return; }
  console.log(JSON.stringify({ sender, recipient, resendEmailId: result.data.id, accepted: true }, null, 2));
})().catch((error) => { console.error(JSON.stringify({ sender, recipient, errorType: error?.name || "ResendError", errorCode: error?.code || null, errorMessage: error?.message || "Email diagnostic failed." }, null, 2)); process.exitCode = 1; });
