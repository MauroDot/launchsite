export type LeadInput = { slug?: unknown; name?: unknown; email?: unknown; phone?: unknown; message?: unknown; website?: unknown };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLeadInput(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Enter your name, email, and message.");
  const value = payload as Record<string, unknown>;
  const allowed = new Set(["slug", "name", "email", "phone", "message", "website"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("This message could not be submitted.");
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const message = typeof value.message === "string" ? value.message.trim() : "";
  const slug = typeof value.slug === "string" ? value.slug.trim() : "";
  const website = typeof value.website === "string" ? value.website.trim() : "";
  if (website) throw new Error("This message could not be submitted.");
  if (name.length < 1 || name.length > 120) throw new Error("Enter your name.");
  if (!emailPattern.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  if (phone.length > 40 || phone && !/^[+()\-\s.\d]+$/.test(phone)) throw new Error("Enter a valid phone number.");
  if (message.length < 1 || message.length > 5000) throw new Error("Enter a message.");
  return { slug: slug || null, name, email, phone: phone || null, message };
}
