"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ClinicalDialog } from "./ClinicalDialog";
import { SignaturePad, type Signature } from "./SignaturePad";

export function ApprovalDialog({ patientId, visitId, section, signerName, onClose, onSigned }: { patientId: string; visitId?: string; section: string; signerName: string; onClose: () => void; onSigned: () => void }) {
  const [preview, setPreview] = useState<{ snapshot: Record<string, unknown>; revision: string } | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<{ snapshot: Record<string, unknown>; revision: string }>(`/patients/${patientId}/${section === "all" ? "approve-all-preview" : `sections/${section}/signing-preview`}${visitId ? `?visit_id=${encodeURIComponent(visitId)}` : ""}`)
      .then(value => { if (active) setPreview(value); }).catch(reason => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [patientId, section, visitId]);
  async function sign() {
    if (!preview || !signature || !confirmed) return;
    setBusy(true); setError("");
    try {
      await apiFetch(`/patients/${patientId}/${section === "all" ? "approve-all" : `sections/${section}/approve`}`, { method: "POST", body: JSON.stringify({ signature, revision: preview.revision, visit_id: visitId || null, confirmed }) });
      onSigned();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval failed"); }
    finally { setBusy(false); }
  }
  return <ClinicalDialog compact title={`Review and sign · ${section}`} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-5 p-6"><p className="text-sm">Signing as <strong>{signerName}</strong>. This approves {section === "all" ? "all reviewable sections" : "the selected section"} for {visitId ? "this visit" : "all visits currently in the record"}.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!preview && !error && <p className="text-sm text-slate-500">Preparing signature...</p>}
      <SignaturePad label="Approver signature" onChange={setSignature} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have reviewed {section === "all" ? "all sections" : "this section"} and approve {section === "all" ? "them" : "it"} with my signature.</label>
      <button type="button" disabled={!preview || !signature || !confirmed || busy} onClick={() => void sign()} className="rounded bg-teal-700 px-5 py-3 text-white disabled:opacity-40">{busy ? "Saving signed approval…" : "Sign and approve"}</button>
    </div>
  </ClinicalDialog>;
}
