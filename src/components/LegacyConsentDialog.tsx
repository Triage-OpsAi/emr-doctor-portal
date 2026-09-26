"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ClinicalDialog } from "./ClinicalDialog";
import { SignatureImage, SignaturePad, type Signature } from "./SignaturePad";
import type { Department } from "./DepartmentManager";

const fields = [
  ["procedure", "Procedure / treatment", "प्रक्रिया / उपचार"], ["purpose", "Why it is needed", "इसकी आवश्यकता क्यों है"],
  ["benefits", "Expected benefits", "अपेक्षित लाभ"], ["risks", "Material risks and patient-specific risks", "महत्वपूर्ण और रोगी-विशिष्ट जोखिम"],
  ["alternatives", "Alternatives, including no treatment", "विकल्प, उपचार न कराना भी"], ["refusal", "Consequences of refusal and withdrawal", "मना करने और सहमति वापस लेने के परिणाम"],
] as const;
type Field = typeof fields[number][0];
type Language = "en" | "hi";
type Texts = Record<Field, Record<Language, string>>;
const rights = {
  en: "You may ask questions, refuse, or withdraw consent. Signing does not guarantee a particular result. Please tell the care team if anything is unclear.",
  hi: "आप प्रश्न पूछ सकते हैं, मना कर सकते हैं या सहमति वापस ले सकते हैं। हस्ताक्षर किसी विशेष परिणाम की गारंटी नहीं हैं। यदि कुछ स्पष्ट नहीं है, तो कृपया देखभाल टीम को बताएं।",
};
export type Consent = { id: string; department_name: string; clinician_name: string; signed_at: string; revision: string; withdrawn_at: string | null; withdrawal_reason: string | null; form: Texts & { patient_name: string; decision: string; language: Language; signer_name: string; signer_type: string; relationship: string; witness_name: string; patient_signature: Signature; clinician_signature: Signature; witness_signature?: Signature } };

export function LegacyConsentDialog({ patientId, patientName, visitId, clinicianName, canCreate, onClose }: { patientId: string; patientName: string; visitId?: string; clinicianName: string; canCreate: boolean; onClose: () => void }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [consents, setConsents] = useState<Consent[]>([]);
  const [texts, setTexts] = useState<Texts>(() => Object.fromEntries(fields.map(([key]) => [key, { en: "", hi: "" }])) as Texts);
  const [language, setLanguage] = useState<Language>("en");
  const [reviewing, setReviewing] = useState(false);
  const [creating, setCreating] = useState(canCreate);
  const [patientSignature, setPatientSignature] = useState<Signature | null>(null);
  const [clinicianSignature, setClinicianSignature] = useState<Signature | null>(null);
  const [witnessSignature, setWitnessSignature] = useState<Signature | null>(null);
  const [signerName, setSignerName] = useState(patientName);
  const [signerType, setSignerType] = useState("patient");
  const [relationship, setRelationship] = useState("");
  const [representativeReason, setRepresentativeReason] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [decision, setDecision] = useState("accepted");
  const [signatureVersion, setSignatureVersion] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const playback = useRef(0);
  const finishPlayback = useRef<(() => void) | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch<Department[]>("/doctor/departments"), apiFetch<Consent[]>(`/patients/${patientId}/consents`), apiFetch<{ department_id: string | null }>("/doctor/my-department")])
      .then(([rows, saved, mine]) => { if (active) { setDepartments(rows); setConsents(saved); setDepartmentId(mine.department_id || ""); } })
      .catch(reason => { if (active) setError(reason.message); });
    // The mutable playback generation cancels whichever audio is active at unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { active = false; playback.current++; audio.current?.pause(); finishPlayback.current?.(); };
  }, [patientId]);
  function stopAudio() { playback.current++; audio.current?.pause(); finishPlayback.current?.(); setSpeaking(false); }
  async function play(form: Texts = texts) {
    stopAudio(); const generation = playback.current; setSpeaking(true); setError("");
    const text = (language === "en" ? "Informed consent form. " : "सूचित सहमति पत्र। ") + fields.map(([key, en, hi]) => `${language === "en" ? en : hi}. ${form[key][language]}`).join("\n\n") + "\n\n" + rights[language];
    const chunks: string[] = [];
    let remainder = text;
    while (remainder.length) {
      let end = Math.min(2300, remainder.length);
      if (end < remainder.length) { const space = remainder.lastIndexOf(" ", end); if (space > 0) end = space; }
      chunks.push(remainder.slice(0, end)); remainder = remainder.slice(end).trimStart();
    }
    try {
      for (const chunk of chunks) {
        if (generation !== playback.current) return;
        const result = await apiFetch<{ audios: string[] }>(`/patients/${patientId}/consent-audio`, { method: "POST", body: JSON.stringify({ text: chunk, language }) });
        for (const encoded of result.audios) {
          if (generation !== playback.current) return;
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
          try {
            const player = new Audio(url); audio.current = player;
            await new Promise<void>((resolve, reject) => { finishPlayback.current = resolve; player.onended = () => resolve(); player.onerror = () => reject(new Error("Unable to play audio on this device")); void player.play().catch(reject); });
          } finally { URL.revokeObjectURL(url); }
        }
      }
    } catch (reason) { if (generation === playback.current) setError(reason instanceof Error ? reason.message : "Audio unavailable. Please read the form aloud."); }
    finally { if (generation === playback.current) setSpeaking(false); }
  }
  async function save() {
    if (!patientSignature || !clinicianSignature || !confirmed) return;
    setBusy(true); setError(""); stopAudio();
    try {
      const saved = await apiFetch<Consent>(`/patients/${patientId}/consents`, { method: "POST", body: JSON.stringify({ ...texts, department_id: departmentId, visit_id: visitId || null,
        language, signer_name: signerName, signer_type: signerType, relationship, representative_reason: representativeReason,
        witness_name: witnessName, witness_signature: witnessSignature, decision, patient_signature: patientSignature,
        clinician_signature: clinicianSignature, explained_and_questions_answered: true, bilingual_content_reviewed: true }) });
      setConsents(current => [saved, ...current]); setCreating(false); setReviewing(false); setExpanded(saved.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save consent"); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!withdrawId) return;
    setBusy(true); setError("");
    try { const updated = await apiFetch<Consent>(`/patients/${patientId}/consents/${withdrawId}/withdraw`, { method: "POST", body: JSON.stringify({ reason: withdrawReason }) }); setConsents(rows => rows.map(row => row.id === updated.id ? updated : row)); setWithdrawId(null); setWithdrawReason(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to record withdrawal"); }
    finally { setBusy(false); }
  }
  const ready = departmentId && fields.every(([key]) => texts[key].en.trim().length >= 2 && texts[key].hi.trim().length >= 2);
  function resetSignatures() { setPatientSignature(null); setClinicianSignature(null); setWitnessSignature(null); setConfirmed(false); setSignatureVersion(value => value + 1); }
  return <ClinicalDialog title="Patient consent / रोगी सहमति" onClose={() => { if (!busy) { stopAudio(); onClose(); } }}><div className="space-y-6 bg-[#f5f6f4] p-4 sm:p-8">
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {!creating ? <>
      {canCreate && <button type="button" onClick={() => { setCreating(true); setConfirmed(false); setPatientSignature(null); setClinicianSignature(null); setWitnessSignature(null); }} className="rounded bg-teal-700 px-4 py-2 text-white">Prepare consent form</button>}
      <p className="text-sm text-slate-600">Procedure-specific consent is available for every department. Record it before relevant invasive procedures, surgery, anaesthesia, transfusion, or other treatments requiring consent under hospital policy.</p>
      {!consents.length && <p>No consent forms recorded.</p>}
      {consents.map(consent => <article key={consent.id} className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{consent.department_name} · {consent.form.procedure[consent.form.language]}</h3><p className="text-sm">{consent.withdrawn_at ? "Withdrawn" : consent.form.decision === "accepted" ? "Consent recorded" : "Declined"} · {new Date(consent.signed_at).toLocaleString()} · {consent.form.signer_name}</p>
        <button className="text-teal-700 underline" onClick={() => setExpanded(expanded === consent.id ? null : consent.id)}>View signed form</button>
        {expanded === consent.id && <><div className="flex flex-wrap items-center gap-3"><select aria-label="Signed consent language" value={language} onChange={e => { stopAudio(); setLanguage(e.target.value as Language); }} className="rounded border p-2"><option value="en">English</option><option value="hi">हिन्दी</option></select><button type="button" className="rounded border px-4 py-2" onClick={() => speaking ? stopAudio() : void play(consent.form)}>{speaking ? "Stop audio" : language === "en" ? "Play in English" : "हिन्दी में सुनें"}</button></div><div lang={language} className="space-y-5 border border-stone-200 bg-white p-6 font-serif leading-8 sm:p-10"><header className="border-b-2 border-slate-800 pb-4"><h3 className="text-2xl">{language === "en" ? "Informed consent form" : "सूचित सहमति पत्र"}</h3><p>{consent.form.patient_name || patientName} · {consent.department_name}</p></header>{fields.map(([key, en, hi]) => <section key={key}><h4 className="font-semibold">{language === "en" ? en : hi}</h4><p className="whitespace-pre-wrap">{consent.form[key][language]}</p></section>)}<p>{rights[language]}</p><p className="border-t pt-4">{consent.form.decision === "accepted" ? "I consent / मैं सहमत हूँ" : "I decline / मैं सहमत नहीं हूँ"} · {consent.form.signer_name}</p></div><div className="flex flex-wrap gap-8"><div><p>Patient / representative</p><SignatureImage signature={consent.form.patient_signature} /></div><div><p>{consent.clinician_name}</p><SignatureImage signature={consent.form.clinician_signature} /></div>{consent.form.witness_signature && <div><p>Witness: {consent.form.witness_name}</p><SignatureImage signature={consent.form.witness_signature} /></div>}</div></>}
        {consent.withdrawn_at && <p className="text-sm">Withdrawal: {consent.withdrawal_reason} · {new Date(consent.withdrawn_at).toLocaleString()}</p>}
        {canCreate && !consent.withdrawn_at && consent.form.decision === "accepted" && <button className="ml-4 text-red-700 underline" onClick={() => setWithdrawId(consent.id)}>Record withdrawal</button>}
        {withdrawId === consent.id && <div className="flex flex-wrap gap-2"><input aria-label="Reason for withdrawal" minLength={3} maxLength={2000} value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} className="rounded border p-2" placeholder="Patient’s reason / request" /><button disabled={busy || withdrawReason.trim().length < 3} onClick={() => void withdraw()} className="rounded border p-2">Confirm withdrawal</button><button onClick={() => setWithdrawId(null)}>Cancel</button></div>}
      </article>)}
    </> : !reviewing ? <>
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-widest text-teal-800">Prepare form · 1 of 2</p><button type="button" onClick={() => setCreating(false)} className="text-sm text-teal-800 underline">Saved consent forms ({consents.length})</button></div>
      <div className="consent-paper space-y-6 border border-stone-200 bg-white p-5 shadow-sm sm:p-10 [&_input]:rounded-none [&_input]:border-0 [&_input]:border-b [&_input]:bg-transparent [&_select]:rounded-none [&_select]:border-0 [&_select]:border-b">
      <header className="border-b-2 border-slate-800 pb-5"><p className="text-xs uppercase tracking-[.2em] text-slate-500">Patient authorization</p><h3 className="mt-2 font-serif text-2xl text-slate-900">Informed consent form</h3><p lang="hi" className="mt-1 text-lg">सूचित सहमति पत्र</p><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><p>Patient / रोगी: <strong>{patientName}</strong></p><p>Clinician / चिकित्सक: <strong>{clinicianName}</strong></p></div></header>
      <p className="text-sm">Complete the procedure details in both languages, then read the form with the patient and collect signatures.</p>
      <label className="block text-sm">Concerned department<select required value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">Select department</option>{departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      {!departments.length && <p className="text-amber-700">A workspace administrator must add departments in Users first.</p>}
      {fields.map(([key, en, hi], index) => <section key={key} className="border-b border-stone-200 pb-5"><h4 className="mb-3 text-sm font-semibold">{index + 1}. {en} / <span lang="hi">{hi}</span></h4><div className="grid gap-5 md:grid-cols-2"><label className="text-xs text-slate-500">English<textarea lang="en" aria-label={`${en} in English`} placeholder={key === "procedure" ? "Name of surgery, procedure, treatment, or digital data use" : `Enter ${en.toLowerCase()}`} value={texts[key].en} maxLength={3000} onChange={e => setTexts({ ...texts, [key]: { ...texts[key], en: e.target.value } })} rows={3} className="mt-2 block w-full resize-y border-0 border-b border-dashed border-slate-300 bg-transparent py-2 text-sm leading-7 text-slate-800 outline-teal-700" /></label><label lang="hi" className="text-xs text-slate-500">हिन्दी<textarea lang="hi" aria-label={`${en} in Hindi`} placeholder="यहाँ विवरण लिखें" value={texts[key].hi} maxLength={3000} onChange={e => setTexts({ ...texts, [key]: { ...texts[key], hi: e.target.value } })} rows={3} className="mt-2 block w-full resize-y border-0 border-b border-dashed border-slate-300 bg-transparent py-2 text-sm leading-7 text-slate-800 outline-teal-700" /></label></div></section>)}
      <p className="text-sm leading-7">The procedure, expected benefits, significant risks, alternatives, and the choice to decline have been explained to me. I have had the opportunity to ask questions and make my own decision.</p><p lang="hi" className="text-sm leading-7">मुझे प्रक्रिया, अपेक्षित लाभ, महत्वपूर्ण जोखिम, विकल्प और मना करने के अधिकार के बारे में समझाया गया है। मुझे प्रश्न पूछने और अपनी इच्छा से निर्णय लेने का अवसर मिला है।</p>

      <div className="grid gap-3 md:grid-cols-2"><label>Signing as<select value={signerType} onChange={e => setSignerType(e.target.value)} className="block w-full rounded border p-2"><option value="patient">Patient</option><option value="representative">Authorized representative</option></select></label><label>Signer name<input value={signerName} maxLength={200} onChange={e => setSignerName(e.target.value)} className="block w-full rounded border p-2" /></label></div>
      {signerType === "representative" && <div className="grid gap-3 md:grid-cols-2"><label>Relationship<input value={relationship} maxLength={200} onChange={e => setRelationship(e.target.value)} className="block w-full rounded border p-2" /></label><label>Why the representative is signing<input value={representativeReason} maxLength={1000} onChange={e => setRepresentativeReason(e.target.value)} className="block w-full rounded border p-2" /></label></div>}
      <label className="block">Witness name {signerType === "representative" ? "(required)" : "(if needed)"}<input value={witnessName} maxLength={200} onChange={e => setWitnessName(e.target.value)} className="block w-full rounded border p-2" /></label>
      <div className="flex gap-3"><button disabled={!ready || signerName.trim().length < 2 || (signerType === "representative" && (!relationship.trim() || !representativeReason.trim() || !witnessName.trim()))} onClick={() => { setReviewing(true); setConfirmed(false); setPatientSignature(null); setClinicianSignature(null); setWitnessSignature(null); }} className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-40">Read with patient</button><button onClick={() => setCreating(false)}>Cancel</button></div>
      </div>
    </> : <>
      <div className="flex flex-wrap items-center gap-3"><label>Read and listen in <select value={language} onChange={e => { stopAudio(); setLanguage(e.target.value as Language); resetSignatures(); }} className="rounded border p-2"><option value="en">English</option><option value="hi">हिन्दी</option></select></label><button type="button" className="rounded border px-4 py-2" onClick={() => speaking ? stopAudio() : void play(texts)}>{speaking ? "Stop audio" : language === "en" ? "Play in English" : "हिन्दी में सुनें"}</button></div>
      <div className="space-y-6 border border-stone-200 bg-white p-5 shadow-sm sm:p-10">
      <div lang={language} className="space-y-6 font-serif text-base leading-8"><h3 className="text-xl font-semibold">{language === "en" ? "Informed consent form" : "सूचित सहमति पत्र"}</h3><p>{patientName} · {departments.find(d => d.id === departmentId)?.name}</p>{fields.map(([key, en, hi]) => <section key={key}><h4 className="font-semibold">{language === "en" ? en : hi}</h4><p className="mt-1 whitespace-pre-wrap leading-7">{texts[key][language]}</p></section>)}<p className="border-t pt-4">{rights[language]}</p></div>
      <p className="text-sm">Signer: {signerName}{signerType === "representative" ? ` · ${relationship} · ${representativeReason}` : ""}</p>
      <label className="block">Patient’s decision / रोगी का निर्णय<select value={decision} onChange={e => { setDecision(e.target.value); resetSignatures(); }} className="ml-3 rounded border p-2"><option value="accepted">I consent / मैं सहमत हूँ</option><option value="declined">I decline / मैं मना करता/करती हूँ</option></select></label>
      <SignaturePad key={`patient-${signatureVersion}`} label="Patient / representative signature · रोगी / प्रतिनिधि के हस्ताक्षर" onChange={setPatientSignature} />
      {witnessName.trim() && <SignaturePad key={`witness-${signatureVersion}`} label={`Witness signature · ${witnessName}`} onChange={setWitnessSignature} />}
      <SignaturePad key={`clinician-${signatureVersion}`} label={`Clinician / staff signature · ${clinicianName}`} onChange={setClinicianSignature} />
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed both language versions for accuracy, explained the procedure and choices, and answered the patient’s questions.</label>
      <div className="flex gap-4"><button disabled={busy || !confirmed || !patientSignature || !clinicianSignature || (!!witnessName.trim() && !witnessSignature)} onClick={() => void save()} className="rounded bg-teal-700 px-5 py-3 text-white disabled:opacity-40">{busy ? "Saving…" : "Save signed decision"}</button><button disabled={busy} onClick={() => { stopAudio(); setReviewing(false); }}>Edit form and sign again</button></div>
      </div>
    </>}
  </div></ClinicalDialog>;
}
