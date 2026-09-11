import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  title: { default: "LaunchSite | Your business, online", template: "%s | LaunchSite" },
  description: "Describe your business and LaunchSite turns it into a professional website.",
  metadataBase: new URL(appUrl),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="page-shell flex min-h-screen flex-col"><SiteHeader /><main className="flex-1">{children}</main><SiteFooter /></div></body></html>;
}
