import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/payments/**": ["./node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff"],
  },
};

export default nextConfig;
