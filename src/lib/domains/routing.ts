export function canRenderCustomDomain(status: string, isPublished: boolean) {
  return status === "ACTIVE" && isPublished;
}

export function isInternalHostname(hostname: string, canonicalHostname: string) {
  return hostname === canonicalHostname || hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.sh");
}
