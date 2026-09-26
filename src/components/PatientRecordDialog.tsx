"use client";

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { DemoConsentPaper } from "./DemoConsentPaper";
import { apiFetch } from "@/lib/api";
function readableRecord(value: unknown, depth = 0): string {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return "";
  if (Array.isArray(value)) return value.map((item, index) => {
    const content = readableRecord(item, depth);
    return content ? (typeof item === "object" ? `Entry ${index + 1}\n${content}` : content) : "";
  }).filter(Boolean).join("\n\n");
  if (typeof value === "object") return Object.entries(value).flatMap(([key, item]) => {
    if (key === "id" || key.endsWith("_id") || key.includes("signature") || ["revision", "section", "section_key", "source_language"].includes(key)) return [];
    const content = readableRecord(item, depth + 1);
    if (!content) return [];
    if (["content", "records", "structured_note", "snapshot"].includes(key)) return [content];
    const label = key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
    return [typeof item === "object" ? `${label}\n${content}` : `${label}: ${content}`];
  }).join("\n");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(Date.parse(text))) return new Date(text).toLocaleString();
  return text.replaceAll("pending_review", "Pending review");
}

function reportMarkup(text: string): string {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return text.split("\n").map(line => {
    if (!line.trim()) return '<div style="height:8px"></div>';
    const colon = line.indexOf(": ");
    if (colon > 0 && colon < 55) return `<div style="padding:3px 0;border-bottom:1px solid #f0f3f3"><span style="font-weight:600;color:#52646b">${escape(line.slice(0,colon))}</span><span>: ${escape(line.slice(colon+2))}</span></div>`;
    if (line.length < 65 && !/[.!?]$/.test(line)) return `<div style="font-weight:700;color:#0c716e;padding:8px 0 3px">${escape(line)}</div>`;
    return `<div style="padding:3px 0">${escape(line)}</div>`;
  }).join("");
}
import { ClinicalDialog } from "./ClinicalDialog";
import { SignatureImage, type Signature } from "./SignaturePad";
import type { Consent } from "./ConsentDialog";

type Attestation = { id: string; section_key: string; visit_id: string | null; signature: Signature; signer_name: string; signer_role: string; signed_at: string; revision: string; snapshot: Record<string, unknown> };
type Bundle = { patient: { id: string; name: string; gender?: string; date_of_birth?: string; phone?: string; patient_reference?: string }; generated_at: string; original_entries: unknown; ward_entries: Record<string, unknown>;
  sections: { key: string; snapshot: Record<string, unknown>; attestation: Attestation | null }[]; consents: Consent[]; attestations: Attestation[] };
type Page = { title: string; text: string; signatures: { name: string; signature: Signature }[]; status: string; signedAt?: string; revision?: string };

const contentStyle = { width: "166mm", font: "12px/1.6 Arial, sans-serif", whiteSpace: "pre-wrap" as const, overflowWrap: "anywhere" as const };

function paginate(section: Page, measure: HTMLDivElement): Page[] {
  const pages: Page[] = [];
  let remaining = section.text || "No entries";
  while (remaining.length) {
    let low = 1, high = remaining.length, fit = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measure.innerHTML = reportMarkup(remaining.slice(0, mid));
      if (measure.scrollHeight <= measure.clientHeight) { fit = mid; low = mid + 1; } else high = mid - 1;
    }
    if (fit < remaining.length) {
      const boundary = Math.max(remaining.lastIndexOf("\n", fit), remaining.lastIndexOf(" ", fit));
      if (boundary > 0) fit = boundary;
    }
    pages.push({ ...section, text: remaining.slice(0, fit) });
    remaining = remaining.slice(fit).trimStart();
  }
  return pages;
}

export function PatientRecordDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [demoPages, setDemoPages] = useState<{consent: Consent; sections: number[]}[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<Bundle>(`/patients/${patientId}/complete-record`).then(async value => {
      await document.fonts.ready;
      if (!active) return;
      const sections: Page[] = [];
      for (const section of value.sections) {
        const signed = section.attestation;
        sections.push({ title: section.key, text: readableRecord(section.snapshot), signatures: signed ? [{ name: `${signed.signer_name} · ${signed.signer_role}`, signature: signed.signature }] : [],
          status: signed ? "Approved · signed version" : "Not signed for this version", signedAt: signed?.signed_at, revision: signed?.revision });
      }
      sections.push({ title: "Original entries · all encounters", text: readableRecord(value.original_entries), signatures: [], status: "Original source entries · not separately signed" });
      for (const [title, entries] of Object.entries(value.ward_entries)) sections.push({ title, text: readableRecord(entries), signatures: [], status: "Ward entries · see individual review metadata" });
      for (const consent of value.consents.filter(item => !item.form.demo)) sections.push({ title: `Consent · ${consent.department_name}`, text: readableRecord({ ...consent.form, withdrawal_reason: consent.withdrawal_reason, withdrawn_at: consent.withdrawn_at }),
        signatures: [{ name: `${consent.form.signer_name} · ${consent.form.signer_type}`, signature: consent.form.patient_signature }, { name: consent.clinician_name, signature: consent.form.clinician_signature }, ...(consent.form.witness_signature ? [{ name: `Witness: ${consent.form.witness_name}`, signature: consent.form.witness_signature }] : [])],
        status: consent.withdrawn_at ? "Consent withdrawn · historical signed form" : consent.form.decision === "accepted" ? "Signed consent" : "Signed refusal", signedAt: consent.signed_at, revision: consent.revision });
      const currentIds = new Set(value.sections.map(section => section.attestation?.id));
      for (const signed of value.attestations.filter(item => !currentIds.has(item.id))) sections.push({ title: `Signed history · ${signed.section_key}${signed.visit_id ? " · visit-specific" : ""}`, text: readableRecord(signed.snapshot),
        signatures: [{ name: `${signed.signer_name} · ${signed.signer_role}`, signature: signed.signature }], status: "Historical approval · applies only to this snapshot", signedAt: signed.signed_at, revision: signed.revision });
      const consentPages: {consent: Consent; sections: number[]}[] = [];
      const paperMeasure = document.createElement("div");
      paperMeasure.className = "demo-report";
      Object.assign(paperMeasure.style, {position:"absolute",left:"-20000px",width:"166mm",visibility:"hidden"});
      document.body.appendChild(paperMeasure);
      const paperRoot = createRoot(paperMeasure);
      try {
        for (const consent of value.consents.filter(item => item.form.demo)) {
          const form = consent.form.demo!;
          let group: number[] = [];
          for (let section = 0; section < 6; section++) {
            const candidate = [...group, section];
            flushSync(() => paperRoot.render(<DemoConsentPaper form={form} language={form.language} sections={candidate} saved />));
            if (paperMeasure.scrollHeight > 700 && group.length) {
              consentPages.push({consent,sections:group});
              group = [section];
            } else group = candidate;
          }
          if (group.length) consentPages.push({consent,sections:group});
        }
      } finally {paperRoot.unmount();paperMeasure.remove();}
      if (active) setDemoPages(consentPages);
      const measure = document.createElement("div");
      Object.assign(measure.style, contentStyle, { position: "absolute", left: "-20000px", height: "174mm", overflow: "hidden", visibility: "hidden" });
      document.body.appendChild(measure);
      try { const populated = sections.filter(section => section.text.trim()); const result = (populated.length ? populated : consentPages.length ? [] : [{ title: "Clinical history", text: "No clinical entries have been recorded for this patient.", signatures: [], status: "No signed entries" }]).flatMap(section => paginate(section, measure)); if (active) { setBundle(value); setPages(result); } }
      finally { measure.remove(); }
    }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [patientId]);
  const totalPages = pages.length + demoPages.length;
  return <ClinicalDialog title="View patient record" onClose={onClose}>
    <style>{`
      .record-page { width:190mm; max-width:100%; box-sizing:border-box; padding:10mm 12mm; margin:20px auto; background:white; color:#172b3a; display:flex; flex-direction:column; border:1px solid #dce5e4; border-radius:8px; box-shadow:0 4px 20px #203e3810; }
      .record-content { flex:none; max-width:100%; margin:0 0 24px; }
      .record-page footer { margin-top:auto; border-top:1px solid #ddd; padding-top:3mm; font:10px/1.3 Arial,sans-serif; }
      .demo-report .demo-consent-paper { font-size:11px; line-height:1.5; }
      .demo-report .text-sm { font-size:11px; line-height:1.5; }
      .demo-report .text-xl { font-size:17px; }
      .demo-report .space-y-7 > :not([hidden]) ~ :not([hidden]) { margin-top:16px; }
      .demo-report .h-20 { height:48px; }
      .demo-report .sm\\:grid-cols-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .demo-report .sm\\:col-span-2 { grid-column:span 2 / span 2; }
      @media print {
        @page { size:A4; margin:10mm; }
        body:has(.record-viewer) > :not(dialog:has(.record-viewer)) { display:none !important; }
        dialog:has(.record-viewer) { position:static !important; display:block !important; overflow:visible !important; width:auto !important; max-width:none !important; height:auto !important; max-height:none !important; margin:0 !important; padding:0 !important; border:0 !important; box-shadow:none !important; }
        dialog:has(.record-viewer)::backdrop { display:none; }
        .record-viewer { overflow:visible !important; padding:0 !important; }
        .record-page { width:190mm; max-width:none; height:277mm; margin:0; padding:10mm 12mm; border:0; border-radius:0; box-shadow:none; break-after:page; break-inside:avoid; } .record-content { height:174mm; margin-bottom:0; }
        .record-page:last-child { break-after:auto; }
      }
    `}</style>
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 print:hidden"><div><p className="text-sm font-semibold text-slate-800">Complete clinical record</p><p className="mt-1 text-xs text-slate-500">All visits · Clinical notes · Treatment · Consent &amp; signed history</p></div><button type="button" disabled={!totalPages} onClick={() => window.print()} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Print / save PDF</button>{error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}{!totalPages && !error && <p className="w-full text-sm text-slate-500">Preparing patient report...</p>}</div>
    <div className="record-viewer bg-[#edf2f1] p-3 sm:p-6">
      {pages.map((page, index) => <article key={index} className="record-page"><header className="mb-5 border-b border-slate-200 pb-4"><div className="flex items-center justify-between gap-4 border-b-2 border-teal-700 pb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal-800">Clinical patient report</p><span className="text-[10px] text-slate-500">{index + 1} / {totalPages}</span></div><h3 className="mt-4 text-xl font-bold text-slate-900">{bundle?.patient.name}</h3><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">{bundle?.patient.patient_reference && <span>Patient reference: {bundle.patient.patient_reference}</span>}{bundle?.patient.gender && <span>Gender: {bundle.patient.gender}</span>}{bundle?.patient.date_of_birth && <span>Date of birth: {bundle.patient.date_of_birth}</span>}{bundle?.patient.phone && <span>Phone: {bundle.patient.phone}</span>}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold capitalize text-teal-800">{page.title.replaceAll("_", " ")}</h4><span className="text-[10px] text-slate-500">Generated {bundle && new Date(bundle.generated_at).toLocaleString()}</span></div></header>
        <div className="record-content" style={contentStyle} dangerouslySetInnerHTML={{ __html: reportMarkup(page.text) }} />
        <footer><div className="flex justify-between gap-2"><span>{page.status}{page.signedAt && ` · ${new Date(page.signedAt).toLocaleString()}`}</span><span>Page {index + 1} / {totalPages}</span></div>
          {page.signatures.length > 0 && <div className="flex justify-between gap-3">{page.signatures.map((item, i) => <div key={i} className="min-w-0 flex-1"><SignatureImage signature={item.signature} label={`${item.name} signature`} /><p>{item.name}</p></div>)}</div>}
          {page.revision && <p className="mt-2 text-[9px] text-slate-400">Verification reference: {page.revision.slice(0, 12).toUpperCase()}</p>}
        </footer>
      </article>)}
      {demoPages.map(({consent,sections}, index) => <article key={`${consent.id}-${index}`} className="record-page">
        <div className="demo-report mb-5"><DemoConsentPaper form={consent.form.demo!} language={consent.form.demo!.language} sections={sections} saved /></div>
        <footer><div className="flex justify-between gap-3"><span>{consent.form.demo!.template.version === "demo-consent-v1" ? "DEMO · " : ""}{consent.withdrawn_at ? "Withdrawn" : "Signed form"} · {new Date(consent.signed_at).toLocaleString()}</span><span>Page {pages.length + index + 1} / {totalPages}</span></div>
          {consent.withdrawn_at && <p>Withdrawal: {consent.withdrawal_reason}</p>}
          <div className="flex justify-between gap-3"><div><SignatureImage signature={consent.form.patient_signature} /><p>{consent.form.signer_name}</p></div><div><SignatureImage signature={consent.form.clinician_signature} /><p>{consent.clinician_name}</p></div>{consent.form.witness_signature && <div><SignatureImage signature={consent.form.witness_signature} /><p>{consent.form.witness_name}</p></div>}</div><p className="mt-2 text-[9px] text-slate-400">Verification reference: {consent.revision.slice(0,12).toUpperCase()}</p>
        </footer>
      </article>)}
    </div>
  </ClinicalDialog>;
}
