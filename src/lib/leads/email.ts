import "server-only";
import { Resend } from "resend";
type LeadNotificationInput = { leadId: string; projectId: string; recipient: string | null; businessName: string; name: string; email: string; phone: string | null; message: string };
function errorDetails(error: unknown) { const value = error as { name?: unknown; message?: unknown; code?: unknown } | null; return { errorType: typeof value?.name === "string" ? value.name : "ResendError", errorCode: typeof value?.code === "string" ? value.code : undefined, errorMessage: typeof value?.message === "string" ? value.message : "Resend rejected the email." }; }
export async function notifyLead(input: LeadNotificationInput) {
  const key = process.env.RESEND_API_KEY?.trim(); const from = process.env.LEAD_NOTIFICATION_FROM?.trim(); const recipient = input.recipient?.trim() || null; const base = { leadId: input.leadId, projectId: input.projectId, selectedRecipient: recipient, configuredSender: from || null, hasResendApiKey: Boolean(key), hasNotificationFrom: Boolean(from) };
  console.info("Lead notification attempt", base);
  if (!key || !from || !recipient) { console.warn("Lead notification skipped", { ...base, finalStatus: "SKIPPED" }); return { ok: false as const, skipped: true as const }; }
  const resend = new Resend(key); const result = await resend.emails.send({ from, to: [recipient], subject: `New lead for ${input.businessName}`, html: `<p><strong>New lead for ${input.businessName}</strong></p><p>Name: ${input.name}</p><p>Email: ${input.email}</p><p>Phone: ${input.phone || "Not provided"}</p><p>${input.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>` });
  if (result.error || !result.data?.id) { const details = errorDetails(result.error); console.error("Lead notification failed", { ...base, ...details, finalStatus: "FAILED" }); throw new Error(details.errorMessage); }
  console.info("Lead notification accepted", { ...base, resendEmailId: result.data.id, finalStatus: "SUCCEEDED" }); return { ok: true as const, id: result.data.id };
}
