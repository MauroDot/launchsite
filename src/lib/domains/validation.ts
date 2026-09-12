import { getAppUrl } from "@/lib/app-url";

const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomainHostname(value: unknown) {
  if (typeof value !== "string") throw new Error("Enter a domain such as example.com.");
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 253 || hostname.includes("/") || hostname.includes(":") || hostname.includes("@") || !hostname.includes(".")) throw new Error("Enter a hostname such as example.com or www.example.com.");
  if (hostname === "localhost" || /^[0-9.]+$/.test(hostname) || hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.sh") || hostname === new URL(getAppUrl()).hostname) throw new Error("That hostname cannot be connected to a LaunchSite site.");
  const labels = hostname.split(".");
  if (labels.some((part) => !label.test(part))) throw new Error("Enter a valid hostname without a protocol, path, or port.");
  return hostname;
}
