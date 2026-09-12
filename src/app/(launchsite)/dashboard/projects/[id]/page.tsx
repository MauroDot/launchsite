import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateWizard } from "@/components/create-wizard";
import { GenerateContentButton } from "@/components/generate-content-button";
import { DemoSettingsForm } from "@/components/demo-settings-form";
import { FeaturedBusinessForm } from "@/components/featured-business-form";
import { PublishSiteControls } from "@/components/publish-site-controls";
import { getFeaturedBusiness, getProject } from "@/lib/project-repository";
import { requireUser } from "@/lib/access";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { getProjectDomainForUser } from "@/lib/domains/service";
import { CustomDomainSettings } from "@/components/custom-domain-settings";
import { SeoSettingsForm } from "@/components/seo-settings-form";
import { ReadinessCard } from "@/components/readiness-card";

export const dynamic = "force-dynamic";
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params; const { edit } = await searchParams; let project: Awaited<ReturnType<typeof getProject>> | undefined; let isAdmin = false;
  try { [project, isAdmin] = await Promise.all([getProject(id), requireUser().then((user) => user.role === "ADMIN")]); } catch (error) { console.error("Unable to load website project", error); }
  if (project === undefined) return <section className="mx-auto max-w-3xl px-5 py-20"><h1 className="text-3xl font-semibold">This project is temporarily unavailable.</h1><p className="mt-4 text-slate-600">Check the database connection and try again.</p></section>;
  if (!project) notFound();
  const featuredBusiness = isAdmin ? await getFeaturedBusiness(project.id) : null;
  let domainState = null;
  if (!project.isDemo) {
    try { const data = await getProjectDomainForUser(project.id); const entitlements = await getUserEntitlements(data.user.id); domainState = { domain: data.domain, canUseCustomDomain: entitlements.canUseCustomDomain }; } catch { domainState = null; }
  }
  return <><div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8"><Link className="text-sm font-semibold text-slate-600" href="/dashboard">Back to projects</Link><h1 className="mt-5 text-3xl font-semibold">{project.business.businessName} {project.isDemo && <span className="rounded-full bg-lime-100 px-2 py-1 text-sm text-lime-800">Demo site</span>}</h1><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold" href={`/dashboard/projects/${project.id}/preview`}>Preview website</Link>{project.isDemo && <Link className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold" href={`/examples/${project.slug}`}>View public example</Link>}<Link className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold" href={`/dashboard/projects/${project.id}/edit-site`}>Edit website</Link><Link className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold" href={`/dashboard/projects/${project.id}?edit=1`}>Edit business facts</Link><GenerateContentButton hasGeneratedContent={Boolean(project.generatedContent)} projectId={project.id} /><Link className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold" href={`/dashboard/analytics?project=${project.id}`}>Analytics</Link></div><div className="mt-6 max-w-2xl" id="publish-controls"><PublishSiteControls businessName={project.business.businessName} isPublished={project.isPublished} projectId={project.id} publicSlug={project.publicSlug} /></div>{domainState && <CustomDomainSettings canUseCustomDomain={domainState.canUseCustomDomain} initialDomain={domainState.domain} isPublished={project.isPublished} projectId={project.id} />}{isAdmin && <><DemoSettingsForm project={project} /><FeaturedBusinessForm featured={featuredBusiness} projectId={project.id} /></>}</div><ReadinessCard project={project} /><SeoSettingsForm initial={project} projectId={project.id} /><CreateWizard initialProject={project} initialStep={edit === "1" ? 0 : 7} /></>;
}
