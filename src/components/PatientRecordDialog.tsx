"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { readableRecord } from "@/lib/clinical-record";
import { ClinicalDialog } from "./ClinicalDialog";
import { SignatureImage, type Signature } from "./SignaturePad";
import type { Consent } from "./ConsentDialog";

type Attestation = { id: string; section_key: string; visit_id: string | null; signature: Signature; signer_name: string; signer_role: string; signed_at: string; revision: string; snapshot: Record<string, unknown> };
type Bundle = { patient: { id: string; name: string }; generated_at: string; original_entries: unknown; ward_entries: Record<string, unknown>;
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
      measure.textContent = remaining.slice(0, mid);
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
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<Bundle>(`/patients/${patientId}/complete-record`).then(async value => {
      await document.fonts.ready;
      if (!active) return;
      const sections: Page[] = [{ title: "Patient details", text: readableRecord(value.patient), signatures: [], status: "Patient demographics" }];
      for (const section of value.sections) {
        const signed = section.attestation;
        sections.push({ title: section.key, text: readableRecord(section.snapshot), signatures: signed ? [{ name: `${signed.signer_name} · ${signed.signer_role}`, signature: signed.signature }] : [],
          status: signed ? "Approved · signed version" : "Not signed for this version", signedAt: signed?.signed_at, revision: signed?.revision });
      }
      sections.push({ title: "Original entries · all encounters", text: readableRecord(value.original_entries), signatures: [], status: "Original source entries · not separately signed" });
      for (const [title, entries] of Object.entries(value.ward_entries)) sections.push({ title, text: readableRecord(entries), signatures: [], status: "Ward entries · see individual review metadata" });
      for (const consent of value.consents) sections.push({ title: `Consent · ${consent.department_name}`, text: readableRecord({ ...consent.form, withdrawal_reason: consent.withdrawal_reason, withdrawn_at: consent.withdrawn_at }),
        signatures: [{ name: `${consent.form.signer_name} · ${consent.form.signer_type}`, signature: consent.form.patient_signature }, { name: consent.clinician_name, signature: consent.form.clinician_signature }, ...(consent.form.witness_signature ? [{ name: `Witness: ${consent.form.witness_name}`, signature: consent.form.witness_signature }] : [])],
        status: consent.withdrawn_at ? "Consent withdrawn · historical signed form" : consent.form.decision === "accepted" ? "Signed consent" : "Signed refusal", signedAt: consent.signed_at, revision: consent.revision });
      const currentIds = new Set(value.sections.map(section => section.attestation?.id));
      for (const signed of value.attestations.filter(item => !currentIds.has(item.id))) sections.push({ title: `Signed history · ${signed.section_key}${signed.visit_id ? " · visit-specific" : ""}`, text: readableRecord(signed.snapshot),
        signatures: [{ name: `${signed.signer_name} · ${signed.signer_role}`, signature: signed.signature }], status: "Historical approval · applies only to this snapshot", signedAt: signed.signed_at, revision: signed.revision });
      const measure = document.createElement("div");
      Object.assign(measure.style, contentStyle, { position: "absolute", left: "-20000px", height: "188mm", overflow: "hidden", visibility: "hidden" });
      document.body.appendChild(measure);
      try { const result = sections.flatMap(section => paginate(section, measure)); if (active) { setBundle(value); setPages(result); } }
      finally { measure.remove(); }
    }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [patientId]);
  return <ClinicalDialog title="View patient record" onClose={onClose}>
    <style>{`
      .record-page { width:190mm; height:277mm; box-sizing:border-box; padding:12mm; margin:16px auto; background:white; color:#172b3a; display:flex; flex-direction:column; border:1px solid #ddd; }
      .record-page pre { flex:none; height:188mm; margin:0; }
      .record-page footer { margin-top:auto; border-top:1px solid #ddd; padding-top:3mm; font:10px/1.3 Arial,sans-serif; }
      @media print {
        @page { size:A4; margin:10mm; }
        body:has(.record-viewer) > :not(dialog:has(.record-viewer)) { display:none !important; }
        dialog:has(.record-viewer) { position:static !important; display:block !important; overflow:visible !important; width:auto !important; max-width:none !important; height:auto !important; max-height:none !important; margin:0 !important; padding:0 !important; border:0 !important; box-shadow:none !important; }
        dialog:has(.record-viewer)::backdrop { display:none; }
        .record-viewer { overflow:visible !important; padding:0 !important; }
        .record-page { margin:0; border:0; break-after:page; break-inside:avoid; }
        .record-page:last-child { break-after:auto; }
      }
    `}</style>
    <div className="p-4 print:hidden"><p className="text-sm">All visits and entries, including signed history. Each signed page shows the signatures for that exact version.</p><button type="button" disabled={!pages.length} onClick={() => window.print()} className="mt-3 rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-40">Print / save PDF</button>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{!pages.length && !error && <p className="mt-3">Preparing complete record…</p>}</div>
    <div className="record-viewer overflow-x-auto bg-slate-100 p-2">
      {pages.map((page, index) => <article key={index} className="record-page"><header className="mb-3"><p className="text-xs">{bundle?.patient.name} · Patient {patientId}</p><h3 className="text-lg font-semibold capitalize">{page.title.replaceAll("_", " ")}</h3><p className="text-xs text-slate-500">Generated {bundle && new Date(bundle.generated_at).toLocaleString()}</p></header>
        <pre style={contentStyle}>{page.text}</pre>
        <footer><div className="flex justify-between gap-2"><span>{page.status}{page.signedAt && ` · ${new Date(page.signedAt).toLocaleString()}`}</span><span>Page {index + 1} / {pages.length}</span></div>
          {page.signatures.length > 0 && <div className="flex justify-between gap-3">{page.signatures.map((item, i) => <div key={i} className="min-w-0 flex-1"><SignatureImage signature={item.signature} label={`${item.name} signature`} /><p>{item.name}</p></div>)}</div>}
          {page.revision && <p className="mt-1 break-all text-[8px]">Signed version: {page.revision}</p>}
        </footer>
      </article>)}
    </div>
  </ClinicalDialog>;
}
