import type { PublicSite } from "@/lib/public-site";
import { publicSiteSeo, structuredBusinessData } from "@/lib/seo";
export function StructuredBusinessData({ project }: { project: PublicSite }) { const seo = publicSiteSeo(project); const data = structuredBusinessData(project, seo.canonicalUrl, seo.image); return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />; }
