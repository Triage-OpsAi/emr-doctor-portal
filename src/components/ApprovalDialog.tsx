"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ClinicalDialog } from "./ClinicalDialog";
import { SignaturePad, type Signature } from "./SignaturePad";
import { readableRecord } from "@/lib/clinical-record";

export function ApprovalDialog({ patientId, visitId, section, signerName, onClose, onSigned }: { patientId: string; visitId?: string; section: string; signerName: string; onClose: () => void; onSigned: () => void }) {
  const [preview, setPreview] = useState<{ snapshot: Record<string, unknown>; revision: string } | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<{ snapshot: Record<string, unknown>; revision: string }>(`/patients/${patientId}/sections/${section}/signing-preview${visitId ? `?visit_id=${encodeURIComponent(visitId)}` : ""}`)
      .then(value => { if (active) setPreview(value); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [patientId, section, visitId]);
  async function sign() {
    if (!preview || !signature || !confirmed) return;
    setBusy(true); setError("");
    try {
      await apiFetch(`/patients/${patientId}/sections/${section}/approve`, { method: "POST", body: JSON.stringify({ signature, revision: preview.revision, visit_id: visitId || null, confirmed }) });
      onSigned();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval failed"); }
    finally { setBusy(false); }
  }
  return <ClinicalDialog title={`Review and sign · ${section}`} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-5 p-6"><p className="text-sm">Signing as <strong>{signerName}</strong>. This approves the displayed section for {visitId ? "this visit" : "all visits currently in the record"}.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {preview ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border bg-slate-50 p-4 font-sans text-sm">{readableRecord(preview.snapshot)}</pre> : <p>Loading the current record…</p>}
      <SignaturePad label="Approver signature" onChange={setSignature} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the displayed content and approve this version.</label>
      <button type="button" disabled={!preview || !signature || !confirmed || busy} onClick={() => void sign()} className="rounded bg-teal-700 px-5 py-3 text-white disabled:opacity-40">{busy ? "Saving signed approval…" : "Sign and approve"}</button>
    </div>
  </ClinicalDialog>;
}
