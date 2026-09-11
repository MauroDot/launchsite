"use client";

import { useState } from "react";
import { SiteRenderer } from "@/components/site-renderer";
import { createWebsiteProject } from "@/lib/generate-site-content";
import { brandTones, callToActions, initialBusinessProfile, visualStyles, type BusinessProfile, type VisualStyle } from "@/lib/website-types";

type Errors = Partial<Record<keyof BusinessProfile, string>>;
const stepLabels = ["Business", "Details", "Style", "Preview"];

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  return <label className="block text-sm font-semibold text-slate-800"><span>{label}</span><span className="mt-2 block">{children}</span>{error && <span className="mt-1 block text-sm font-medium text-rose-600">{error}</span>}</label>;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-3 focus:ring-slate-900/10";

export function CreateWizard() {
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessProfile>(initialBusinessProfile);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("Modern");
  const [errors, setErrors] = useState<Errors>({});
  const project = createWebsiteProject({ business, visualStyle });

  function updateField<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setBusiness((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateCurrentStep() {
    const nextErrors: Errors = {};
    if (step === 0) {
      if (!business.businessName.trim()) nextErrors.businessName = "Please enter your business name.";
      if (!business.category.trim()) nextErrors.category = "Please enter your business type.";
      if (business.description.trim().length < 20) nextErrors.description = "Add a short description of at least 20 characters.";
      if (!business.serviceArea.trim()) nextErrors.serviceArea = "Please enter the area you serve.";
    }
    if (step === 1) {
      if (!business.phone.trim()) nextErrors.phone = "Please enter a phone number.";
      if (!/^\S+@\S+\.\S+$/.test(business.email)) nextErrors.email = "Please enter a valid email address.";
      if (!business.services.trim()) nextErrors.services = "Add at least one service.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function next() {
    if (step < 2 && !validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, 3));
  }

  return <section className="bg-slate-50 py-10 sm:py-14"><div className="mx-auto max-w-6xl px-5 sm:px-8">
    {step < 3 && <div className="mx-auto max-w-3xl"><p className="eyebrow">Create your website</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-5xl">A few details, then we’ll shape your site.</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Start with the things you know best—your business and the people you serve.</p></div>}
    <div className={step === 3 ? "mt-0" : "mx-auto mt-10 max-w-3xl"}>
      <ol aria-label="Website creation progress" className={`mb-8 grid grid-cols-4 gap-2 ${step === 3 ? "mx-auto max-w-3xl px-1 pt-2" : ""}`}>{stepLabels.map((label, index) => <li className="flex min-w-0 items-center gap-2" key={label}><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index <= step ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"}`}>{index + 1}</span><span className={`hidden truncate text-sm font-semibold sm:block ${index <= step ? "text-slate-900" : "text-slate-400"}`}>{label}</span></li>)}</ol>
      {step === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-baseline justify-between"><h2 className="text-2xl font-semibold tracking-[-0.04em]">The basics</h2><p className="text-sm text-slate-500">Step 1 of 3</p></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field error={errors.businessName} label="Business name *"><input className={inputClass} onChange={(event) => updateField("businessName", event.target.value)} placeholder="Westside Gardens" value={business.businessName} /></Field><Field error={errors.category} label="Business type *"><input className={inputClass} onChange={(event) => updateField("category", event.target.value)} placeholder="Landscape design" value={business.category} /></Field><div className="sm:col-span-2"><Field error={errors.description} label="In a sentence or two, what does your business do? *"><textarea className={`${inputClass} min-h-28 resize-y`} onChange={(event) => updateField("description", event.target.value)} placeholder="We design and maintain outdoor spaces for homeowners who want a yard they love coming home to." value={business.description} /></Field></div><div className="sm:col-span-2"><Field error={errors.serviceArea} label="Primary service area *"><input className={inputClass} onChange={(event) => updateField("serviceArea", event.target.value)} placeholder="Tulsa and surrounding areas" value={business.serviceArea} /></Field></div></div><div className="mt-8 flex justify-end"><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700" onClick={next} type="button">Continue <span className="ml-1">→</span></button></div></div>}
      {step === 1 && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-baseline justify-between"><h2 className="text-2xl font-semibold tracking-[-0.04em]">Services and contact</h2><p className="text-sm text-slate-500">Step 2 of 3</p></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field error={errors.phone} label="Phone number *"><input className={inputClass} inputMode="tel" onChange={(event) => updateField("phone", event.target.value)} placeholder="(918) 555-0142" value={business.phone} /></Field><Field error={errors.email} label="Email address *"><input className={inputClass} inputMode="email" onChange={(event) => updateField("email", event.target.value)} placeholder="hello@westsidegardens.com" type="email" value={business.email} /></Field><div className="sm:col-span-2"><Field error={errors.services} label="Services offered *"><textarea className={`${inputClass} min-h-28 resize-y`} onChange={(event) => updateField("services", event.target.value)} placeholder="Landscape design, lawn care, seasonal planting" value={business.services} /><span className="mt-1 block text-sm font-normal text-slate-500">Separate services with commas or new lines.</span></Field></div><Field label="Years in business"><input className={inputClass} inputMode="numeric" min="0" onChange={(event) => updateField("yearsInBusiness", event.target.value)} placeholder="10" type="number" value={business.yearsInBusiness} /></Field><Field label="Preferred brand tone"><select className={inputClass} onChange={(event) => updateField("tone", event.target.value as BusinessProfile["tone"])} value={business.tone}>{brandTones.map((tone) => <option key={tone}>{tone}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Primary call-to-action"><select className={inputClass} onChange={(event) => updateField("callToAction", event.target.value as BusinessProfile["callToAction"])} value={business.callToAction}>{callToActions.map((action) => <option key={action}>{action}</option>)}</select></Field></div></div><div className="mt-8 flex justify-between"><button className="rounded-full px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setStep(0)} type="button">← Back</button><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700" onClick={next} type="button">Continue <span className="ml-1">→</span></button></div></div>}
      {step === 2 && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-baseline justify-between"><h2 className="text-2xl font-semibold tracking-[-0.04em]">Choose a visual direction</h2><p className="text-sm text-slate-500">Step 3 of 3</p></div><p className="mt-3 text-slate-600">This gives your first website a starting personality. You can refine it later.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{visualStyles.map((style) => <button aria-pressed={visualStyle === style} className={`rounded-xl border p-5 text-left transition ${visualStyle === style ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/15" : "border-slate-200 bg-white hover:border-slate-400"}`} key={style} onClick={() => setVisualStyle(style)} type="button"><span className={`block size-8 rounded-full ${style === "Modern" ? "bg-cyan-400" : style === "Bold" ? "bg-orange-500" : style === "Professional" ? "bg-blue-700" : style === "Friendly" ? "bg-lime-400" : "bg-stone-800"}`} /><span className="mt-7 block text-lg font-semibold">{style}</span><span className={`mt-1 block text-sm ${visualStyle === style ? "text-slate-300" : "text-slate-500"}`}>{style === "Modern" ? "Clear, crisp, and current" : style === "Bold" ? "High energy and confident" : style === "Professional" ? "Established and polished" : style === "Friendly" ? "Warm and approachable" : "Quiet and refined"}</span></button>)}</div><div className="mt-8 flex justify-between"><button className="rounded-full px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setStep(1)} type="button">← Back</button><button className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700" onClick={next} type="button">Generate my preview <span className="ml-1">→</span></button></div></div>}
      {step === 3 && <div><div className="mx-auto mb-7 flex max-w-6xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-lime-700">Preview generated</p><h1 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Here’s your first website direction.</h1></div><button className="w-fit rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500" onClick={() => setStep(2)} type="button">← Edit details</button></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/20"><SiteRenderer project={project} /></div></div>}
    </div></div></section>;
}
