import type { Metadata } from "next";
import "./globals.css";
import { getAppUrl } from "@/lib/app-url";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: { default: "LaunchSite | Your business, online", template: "%s | LaunchSite" },
  description: "Describe your business and LaunchSite turns it into a professional website.",
  metadataBase: new URL(appUrl),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
