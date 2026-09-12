import "server-only";

export async function notifyLead(input: { leadId: string; projectId: string; recipient: string; businessName: string; name: string; email: string; phone: string | null; message: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.LEAD_NOTIFICATION_FROM?.trim();
  if (!key || !from || !input.recipient) return;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.recipient], subject: `New lead for ${input.businessName}`, text: `Name: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone || "Not provided"}\n\n${input.message}\n\nOpen your LaunchSite lead inbox to respond.` }) });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
}
