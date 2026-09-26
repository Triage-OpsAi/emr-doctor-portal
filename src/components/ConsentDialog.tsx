"use client";

import { useEffect, useState } from "react";
import { useConsentAudio, splitConsentAudio } from "@/lib/useConsentAudio";
import { apiFetch } from "@/lib/api";
import { consentAudio, hasEntry, type Choice, type Context, type DemoForm, type Entry, type Field, type Language } from "@/lib/demo-consent";
import { ClinicalDialog } from "./ClinicalDialog";
import { DemoConsentPaper } from "./DemoConsentPaper";
import { LegacyConsentDialog, type Consent as LegacyConsent } from "./LegacyConsentDialog";
import type { Department } from "./DepartmentManager";
import type { Signature } from "./SignaturePad";

export type Consent = Omit<LegacyConsent, "form"> & { form: LegacyConsent["form"] & { demo?: DemoForm } };
type Props = { patientId: string; patientName: string; visitId?: string; clinicianName: string; canCreate: boolean; onClose: () => void };

export function ConsentDialog(props: Props) {
  const { patientId, visitId, canCreate, onClose } = props;
  const [context, setContext] = useState<Context | null>(null);
  const [form, setForm] = useState<DemoForm | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [consents, setConsents] = useState<Consent[]>([]);
  const [language, setLanguage] = useState<Language>("en");
  const [creating, setCreating] = useState(canCreate);
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signatureVersion, setSignatureVersion] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const audioPlayback = useConsentAudio(patientId);
  const { stop: stopAudio, preload } = audioPlayback;
  const speaking = audioPlayback.state !== "idle";
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const blank = (data: Context): DemoForm => ({...data, fields:structuredClone(data.prefill || {}),language:"en",data_decision:null,procedure_decision:null,patient_signature:null,clinician_signature:null,witness_signature:null});
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch<Context>(`/patients/${patientId}/consent-template`), apiFetch<Department[]>("/doctor/departments"), apiFetch<{department_id:string|null}>("/doctor/my-department"),apiFetch<Consent[]>(`/patients/${patientId}/consents`)])
      .then(([data, rows, mine, saved]) => {if(active){setContext(data);setForm(blank(data));setDepartments(rows.filter(row => row.is_active));setDepartmentId(mine.department_id && rows.some(row=>row.id===mine.department_id && row.is_active) ? mine.department_id : "");setConsents(saved);}})
      .catch(e => {if(active)setError(e instanceof Error ? e.message : "Unable to load consent form");});
    return () => {active=false;};
  }, [patientId]);
  function resetSignatures() {setConfirmed(false);setSignatureVersion(v=>v+1);setForm(f=>f?{...f,patient_signature:null,clinician_signature:null,witness_signature:null}:f);}
  function field(key: Field, value: Entry) {stopAudio();setForm(f=>f?{...f,fields:{...f.fields,[key]:value}}:f);}
  function choice(key: "data_decision" | "procedure_decision", value: Choice) {stopAudio();setForm(f=>f?{...f,[key]:value}:f);}
  function signature(key: "patient_signature" | "clinician_signature" | "witness_signature", value: Signature | null) {setForm(f=>f?{...f,[key]:value}:f);}
  function play(value: DemoForm) { setError(""); return audioPlayback.play(consentAudio(value, language), language); }
  async function save(){
    if(!form)return;setBusy(true);setError("");stopAudio();
    try{const saved=await apiFetch<Consent>(`/patients/${patientId}/consents/form`,{method:"POST",body:JSON.stringify({template_version:form.template.version,department_id:departmentId,visit_id:visitId||null,language,fields:form.fields,data_decision:form.data_decision,procedure_decision:form.procedure_decision,patient_signature:form.patient_signature,clinician_signature:form.clinician_signature,witness_signature:form.witness_signature,confirmed})});setConsents(rows=>[saved,...rows]);setCreating(false);setReviewing(false);setExpanded(saved.id);document.querySelector("dialog[open]")?.scrollTo({top:0});}
    catch(e){setError(e instanceof Error?e.message:"Unable to save consent");}finally{setBusy(false);}
  }
  async function withdraw(){if(!withdrawId)return;setBusy(true);setError("");try{const updated=await apiFetch<Consent>(`/patients/${patientId}/consents/${withdrawId}/withdraw`,{method:"POST",body:JSON.stringify({reason})});setConsents(rows=>rows.map(row=>row.id===updated.id?updated:row));setWithdrawId(null);setReason("");}catch(e){setError(e instanceof Error?e.message:"Unable to record withdrawal");}finally{setBusy(false);}}
  const t=context?.template[language];
  const ready=!!form && !!departmentId && !!form.data_decision && !!form.procedure_decision && (["patient_name","representative_name","clinician_name","procedure","purpose"] as Field[]).every(key=>hasEntry(form.fields[key]));
  const witnessValid=!!form && hasEntry(form.fields.witness_name)===!!form.witness_signature && (!hasEntry(form.fields.witness_date)||!!form.witness_signature);
  const selected=creating?form:consents.find(row=>row.id===expanded)?.form.demo;
  const openingAudio = selected ? splitConsentAudio(consentAudio(selected, language))[0] : "";
  useEffect(() => {
    if (!openingAudio || legacy) return;
    const timer = window.setTimeout(() => preload(openingAudio, language), 150);
    return () => window.clearTimeout(timer);
  }, [openingAudio, language, legacy, preload]);
  if(legacy)return <LegacyConsentDialog {...props} canCreate={false} onClose={()=>setLegacy(false)} />;
  return <ClinicalDialog title="Patient consent / रोगी सहमति" onClose={()=>{if(!busy){stopAudio();onClose();}}}>
    <div className="border-b bg-white px-5 py-4 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2 rounded-lg bg-slate-100 p-1">{(["en","hi"] as const).map(lang=><button key={lang} type="button" disabled={busy} aria-pressed={language===lang} onClick={()=>{stopAudio();setLanguage(lang);if(creating)resetSignatures();}} className={`rounded-md px-4 py-2 text-sm font-semibold ${language===lang?"bg-white text-teal-800 shadow-sm":"text-slate-500"}`}>{lang==="en"?"English":"हिन्दी"}</button>)}</div><div className="flex gap-3"><button type="button" disabled={!selected} onClick={()=>{if(speaking)stopAudio();else if(selected)void play(selected);}} className="rounded-lg border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40">{audioPlayback.state==="loading"?(language==="en"?"Preparing audio · Cancel":"ऑडियो तैयार हो रहा है · रोकें"):speaking?(language==="en"?"Stop audio":"ऑडियो रोकें"):(language==="en"?"▶ Listen in English":"▶ हिन्दी में सुनें")}</button><button type="button" disabled={busy} onClick={()=>{stopAudio();setCreating(canCreate ? !creating : false);setError("");if(!creating && context){setForm(blank(context));setReviewing(false);setConfirmed(false);setSignatureVersion(v=>v+1);}}} className="text-sm font-semibold text-teal-800 disabled:opacity-40">{creating?`Saved forms (${consents.length})`:canCreate?"New form":"Saved forms"}</button></div></div>{t && <p className="mt-3 text-xs leading-5 text-slate-500">{t.audio_hint}</p>}</div>
    <div className="bg-[#edf2f0] p-3 sm:p-6">{(error || audioPlayback.error) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || audioPlayback.error}</p>}{!form&&!error&&<p className="p-6 text-sm">Loading consent form...</p>}
      {creating&&form&&t&&canCreate?<>
        <div className="mx-auto mb-4 flex max-w-[780px] flex-wrap items-center justify-between gap-3 text-xs"><span className="font-semibold text-teal-800">{reviewing?(language==="en"?"2 · Review & sign":"2 · समीक्षा और हस्ताक्षर"):(language==="en"?"1 · Fill in details & tick your choices":"1 · विवरण भरें और विकल्प चुनें")}</span><label className="flex items-center gap-2">{language==="en"?"Department":"विभाग"}<select disabled={reviewing||busy} aria-label="Department" value={departmentId} onChange={e=>setDepartmentId(e.target.value)} className="max-w-52 rounded-lg border border-slate-300 bg-white p-2"><option value="">{language==="en"?"Select department":"विभाग चुनें"}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div>
        <div className="mx-auto max-w-[780px] rounded-sm border border-slate-200 bg-white p-5 shadow-sm sm:p-10"><DemoConsentPaper key={`draft-${signatureVersion}`} form={form} language={language} onField={reviewing?undefined:field} onChoice={reviewing?undefined:choice} onSignature={reviewing&&!busy?signature:undefined} signatureVersion={signatureVersion} />
          <div className="mt-7 border-t border-slate-200 pt-5">{reviewing?<><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" />{t.confirmation}</label><div className="mt-4 flex flex-wrap gap-4"><button type="button" disabled={busy||!ready||!confirmed||!form.patient_signature||!form.clinician_signature||!witnessValid} onClick={()=>void save()} className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?(language==="en"?"Saving...":"सहेज रहे हैं..."):t.save}</button><button type="button" disabled={busy} onClick={()=>{stopAudio();resetSignatures();setReviewing(false);}} className="text-sm text-teal-800 underline">{language==="en"?"Edit details & sign again":"विवरण बदलें और फिर हस्ताक्षर करें"}</button></div></>:<><p className="mb-3 text-xs text-slate-500">{language==="en"?"Complete the starred fields, choose a department, and tick one option in each consent section. Names and other details can be handwritten.":"तारांकित विवरण भरें, विभाग चुनें और दोनों सहमति अनुभागों में एक-एक विकल्प चुनें। नाम और अन्य विवरण हाथ से लिखे जा सकते हैं।"}</p><button type="button" disabled={!ready} onClick={()=>{stopAudio();setReviewing(true);resetSignatures();}} className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{language==="en"?"Continue to signatures":"हस्ताक्षर करें"}</button></>}</div>
        </div></>:!creating&&<div className="mx-auto max-w-[780px] space-y-4">{!consents.length&&<p className="rounded-lg bg-white p-6 text-sm text-slate-500">{language==="en"?"No signed forms yet.":"अभी कोई हस्ताक्षरित पत्र नहीं है।"}</p>}{consents.map(row=><article key={row.id} className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">{row.form.demo?(row.form.demo.template.version === "demo-consent-v1" ? "Historical demo consent" : "Patient consent · Data sharing & procedure"):row.form.procedure[language]}</h3><p className="mt-1 text-xs text-slate-500">{row.department_name} · {new Date(row.signed_at).toLocaleString()} {row.withdrawn_at&&"· Withdrawn"}</p></div><button type="button" onClick={()=>{stopAudio();if(!row.form.demo)setLegacy(true);else setExpanded(expanded===row.id?null:row.id);}} className="text-sm font-semibold text-teal-700">{expanded===row.id?"Hide form":"View signed form"}</button></div>{expanded===row.id&&row.form.demo&&<div className="mt-6 border-t pt-6"><DemoConsentPaper form={row.form.demo} language={language} saved /></div>}{row.withdrawn_at&&<p className="mt-3 text-sm text-red-700">Withdrawal: {row.withdrawal_reason}</p>}{canCreate&&!row.withdrawn_at&&row.form.decision==="accepted"&&<button type="button" className="mt-3 text-xs text-red-700 underline" onClick={()=>setWithdrawId(row.id)}>Record withdrawal</button>}{withdrawId===row.id&&<div className="mt-3 flex flex-wrap gap-3"><input aria-label="Withdrawal reason" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} className="rounded border p-2 text-sm" placeholder="Reason for withdrawal" /><button type="button" disabled={busy||reason.trim().length<3} onClick={()=>void withdraw()} className="text-sm text-red-700 disabled:opacity-40">Confirm withdrawal</button><button type="button" onClick={()=>setWithdrawId(null)} className="text-sm">Cancel</button></div>}</article>)}</div>}
    </div>
  </ClinicalDialog>;
}
