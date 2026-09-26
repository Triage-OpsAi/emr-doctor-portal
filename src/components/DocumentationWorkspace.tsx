"use client";
import { useEffect, useRef, useState } from "react";
import { ClinicalDialog } from "./ClinicalDialog";
import { Icon } from "./Icon";
import { SignaturePad, SignatureImage, type Signature } from "./SignaturePad";
import { documentationService as service, destinationLabels, type ClinicalDocument, type DocumentContext, type DocumentationTemplate } from "@/lib/documentation";
import { documentationDemos } from "@/lib/documentationDemos";
const button = "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40";
const primary = `${button} !border-teal-700 !bg-teal-700 !text-white`;
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm disabled:bg-slate-50";
function values(doc: ClinicalDocument) { return Object.fromEntries(Object.entries(doc.fields).map(([key, field]) => [key, field.value])); }
function undocumented(value: string) { return !value?.trim() || /\b(not documented|not mentioned|not discussed|not provided|not assessed|unknown)\b/i.test(value); }
function documentationChecks(template: DocumentationTemplate, fields: Record<string, string>) {
    const result = template.fields.filter(field => field.required && undocumented(fields[field.key] || "")).map(field => ({ key: field.key, message: `${field.label} not documented` }));
    if (template.specialty === "Radiology" && fields.critical_finding?.trim())
        for (const key of ["person_contacted", "communication_date_and_time", "communication_method", "communication_status"])
            if (undocumented(fields[key] || ""))
                result.push({ key, message: `${key.replaceAll("_", " ")} not documented` });
    return result;
}
export function DocumentationWorkspace({ patientId, visitId, initialDocument, canWrite, canSign, onClose, onSaved }: {
    patientId: string;
    visitId?: string;
    initialDocument?: ClinicalDocument;
    canWrite: boolean;
    canSign: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [context, setContext] = useState<DocumentContext | null>(null), [templates, setTemplates] = useState<DocumentationTemplate[]>([]), [documents, setDocuments] = useState<ClinicalDocument[]>([]);
    const [encounter, setEncounter] = useState(""), [specialty, setSpecialty] = useState("General Medicine"), [templateId, setTemplateId] = useState("medicine_opd");
    const [doc, setDoc] = useState<ClinicalDocument | null>(initialDocument || null), [transcript, setTranscript] = useState(initialDocument?.transcript || ""), [original, setOriginal] = useState(initialDocument?.original_transcript || "");
    const [fields, setFields] = useState<Record<string, string>>(initialDocument ? values(initialDocument) : {}), [mode, setMode] = useState<"structured" | "narrative">(initialDocument?.mode || "structured");
    const [ack, setAck] = useState<Record<string, string>>(initialDocument?.reviewed_checks || {}), [signature, setSignature] = useState<Signature | null>(null), [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(""), [error, setError] = useState(""), [dirty, setDirty] = useState(false), [demo, setDemo] = useState(false), [notice, setNotice] = useState("");
    const [recording, setRecording] = useState<"idle" | "recording" | "paused">("idle"), [seconds, setSeconds] = useState(0), [audio, setAudio] = useState<Blob | null>(null), [audioUrl, setAudioUrl] = useState("");
    const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), chunks = useRef<Blob[]>([]), alive = useRef(true);
    const template = doc?.template || templates.find(item => item.id === templateId);
    const locked = doc?.status === "finalized" || (!canWrite && !demo), working = Boolean(busy) || recording !== "idle";
    const ctx = doc?.context || (context ? { ...context.patient, encounter: context.encounters.find(item => item.id === encounter) } : null);
    const checks = template ? documentationChecks(template, fields) : [];
    useEffect(() => { let active = true; Promise.all([service.context(patientId), service.templates(), service.list(patientId)]).then(([ctx, items, saved]) => { if (!active)
        return; setContext(ctx); setTemplates(items); setDocuments(saved); const selected = ctx.encounters.find(e => !visitId || e.visit_id === visitId); if (selected) {
        setEncounter(selected.id);
        setSpecialty(selected.specialty);
        setTemplateId(items.find(t => t.specialty === selected.specialty)?.id || "medicine_opd");
    } }).catch(reason => { if (active)
        setError(reason.message); }); return () => { active = false; }; }, [patientId, visitId]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state !== "inactive")
        recorder.current?.stop(); stream.current?.getTracks().forEach(track => track.stop()); }; }, []);
    useEffect(() => { if (recording !== "recording")
        return; const timer = setInterval(() => setSeconds(value => value + 1), 1000); return () => clearInterval(timer); }, [recording]);
    useEffect(() => { if (seconds >= 300 && recorder.current?.state !== "inactive")
        recorder.current?.stop(); }, [seconds]);
    useEffect(() => () => { if (audioUrl)
        URL.revokeObjectURL(audioUrl); }, [audioUrl]);
    useEffect(() => { if (!dirty)
        return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
    function accept(value: ClinicalDocument) { setDoc(value); setTranscript(value.transcript); setOriginal(value.original_transcript); setFields(values(value)); setMode(value.mode); setAck(value.reviewed_checks); setSignature(null); setConfirm(false); setDirty(false); if (!demo)
        setDocuments(current => [value, ...current.filter(item => item.id !== value.id)]); }
    function leave() { if (working)
        return; if (dirty && !window.confirm("Discard unsaved documentation changes?"))
        return; onClose(); }
    async function run(label: string, fn: () => Promise<void>) { setBusy(label); setError(""); setNotice(""); try {
        await fn();
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to complete the action");
    }
    finally {
        setBusy("");
    } }
    function changed() { setDirty(true); setSignature(null); setConfirm(false); }
    async function saved() {
        if (!template)
            throw Error("Select a documentation template");
        let current = doc;
        if (demo && current) {
            current = { ...current, transcript, fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, source: current?.fields[key]?.value === value ? current.fields[key].source : "clinician_entered", evidence: current?.fields[key]?.evidence || "" }])), mode, status: "draft", reviewed_checks: {}, revision: current.revision + 1 };
            accept(current);
            return current;
        }
        if (!current) {
            current = await service.create(patientId, encounter, template.id, transcript, original);
            setDoc(current);
        }
        if (dirty || !doc)
            current = await service.save(current, transcript, fields, mode);
        accept(current);
        return current;
    }
    async function generate() { await run("Structuring dictated information…", async () => { let current = await saved(); if (demo) {
        const extracted: ClinicalDocument["fields"] = {};
        for (const field of current.template.fields) {
            const line = current.transcript.split("\n").find(line => line.toLowerCase().startsWith(field.label.toLowerCase() + ":"));
            if (line) {
                const value = line.slice(line.indexOf(":") + 1).trim();
                extracted[field.key] = { value, source: "dictation", evidence: value };
            }
        }
        current = { ...current, fields: { ...extracted, ...Object.fromEntries(Object.entries(current.fields).filter(([, v]) => v.source === "clinician_entered")) }, status: "needs_review", revision: current.revision + 1 };
    }
    else
        current = await service.generate(current); accept(current); setNotice("Draft generated. Review every field against the transcript."); }); }
    async function review() { await run("Saving review…", async () => { const reasons = { ...ack }; let current = await saved(); if (demo) {
        if (checks.some(c => !reasons[c.key] || reasons[c.key].trim().length < 3))
            throw Error("Record a reason for each missing field or complete it.");
        current = { ...current, status: "reviewed", reviewed_checks: reasons, revision: current.revision + 1 };
    }
    else
        current = await service.review(current, reasons); accept(current); }); }
    async function finalize() { if (!doc || !signature || !confirm)
        return; await run("Signing and finalizing…", async () => { const next = demo ? { ...doc, status: "finalized", signature, signer_name: "Demo clinician", signed_at: new Date().toISOString(), revision: doc.revision + 1 } : await service.finalize(doc, signature); accept(next); if (!demo)
        onSaved(); setNotice(demo ? "Demo finalized locally. No patient record was changed." : `Signed and saved to ${destinationLabels[next.destination]}.`); }); }
    async function start() { await run("Opening microphone…", async () => { if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw Error("Microphone recording requires a supported browser on HTTPS or localhost."); const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true }); if (!alive.current) {
        nextStream.getTracks().forEach(t => t.stop());
        return;
    } stream.current = nextStream; const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type)); const next = new MediaRecorder(nextStream, mime ? { mimeType: mime } : undefined); recorder.current = next; chunks.current = []; next.ondataavailable = e => { if (e.data.size)
        chunks.current.push(e.data); }; next.onstop = () => { nextStream.getTracks().forEach(track => track.stop()); if (alive.current) {
        const clip = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        setAudio(clip);
        setAudioUrl(URL.createObjectURL(clip));
        setRecording("idle");
    } }; next.onerror = () => { nextStream.getTracks().forEach(track => track.stop()); setRecording("idle"); setError("Recording failed. Retry or enter a transcript."); }; setSeconds(0); setAudio(null); setAudioUrl(""); next.start(1000); setRecording("recording"); }); }
    function openDocument(value: ClinicalDocument) { if (dirty && !window.confirm("Discard unsaved changes?"))
        return; setDemo(false); accept(value); setAudio(null); setAudioUrl(""); setNotice(""); }
    function newDocument() { if (dirty && !window.confirm("Discard unsaved changes?"))
        return; setDoc(null); setDemo(false); setFields({}); setTranscript(""); setOriginal(""); setAck({}); setAudio(null); setAudioUrl(""); setSignature(null); setConfirm(false); setDirty(false); setNotice(""); }
    function loadDemo(index: number) { const sample = documentationDemos[index], t = templates.find(t => t.id === sample.template); if (!t)
        return; if (dirty && !window.confirm("Discard unsaved changes?"))
        return; setDemo(true); setAudio(null); setAudioUrl(""); const now = new Date().toISOString(); accept({ id: "demo", patient_id: "demo", encounter_id: "demo", template: t, context: { id: "demo", name: "Demonstration patient", reference: "DEMO-ONLY", date_of_birth: null, gender: null, encounter: { id: "demo", visit_id: null, reference: "DEMO-ENCOUNTER", department: t.specialty, clinician: "Demo clinician", date: now, specialty: t.specialty } }, transcript: sample.text, original_transcript: sample.text, fields: {}, mode: "structured", status: "draft", revision: 1, checks: [], reviewed_checks: {}, signature: null, signer_name: null, signed_at: null, signed_digest: null, destination: t.destination, created_at: now, updated_at: now }); setNotice("Synthetic scenario. Generation, review and signatures remain local and cannot enter the patient record."); }
    const previous: ClinicalDocument | undefined = demo && doc?.template.specialty === "Oncology" ? { ...doc, created_at: "2026-09-05T10:00:00Z", fields: { ...doc.fields, current_cycle: { value: "Cycle two review", source: "dictation", evidence: "Cycle two review" }, toxicities: { value: "No nausea reported at previous demonstration visit", source: "dictation", evidence: "No nausea reported" } } } : documents.filter(item => item.status === "finalized" && item.template.specialty === "Oncology" && item.encounter_id !== (doc?.encounter_id || encounter) && new Date(item.context.encounter.date).getTime() < new Date(ctx?.encounter?.date || "").getTime()).sort((a, b) => new Date(b.context.encounter.date).getTime() - new Date(a.context.encounter.date).getTime())[0];
    return <ClinicalDialog title="WARDVOICE · Clinical documentation" onClose={leave}>
  <div className="space-y-5 bg-[#f6f9fa] p-4 sm:p-6">
   {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
   {notice && <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{notice}</p>}
   {demo && <div className="rounded-lg bg-amber-100 p-3 text-sm font-semibold text-amber-900">Demonstration mode · synthetic patient · no EMR writes<button onClick={newDocument} disabled={working} className="ml-3 underline">Return to patient</button></div>}
   <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{ctx?.name || "Loading patient…"}</h3><p className="mt-1 text-xs text-slate-500">Patient reference / UHID: {ctx?.reference || "—"}{ctx?.date_of_birth ? ` · Born ${new Date(ctx.date_of_birth).toLocaleDateString()}` : ""}</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold capitalize text-teal-800">{dirty ? "Unsaved changes" : doc?.status.replaceAll("_", " ") || "New draft"}</span></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-4">{[["Encounter", ctx?.encounter?.reference], ["Clinician", ctx?.encounter?.clinician], ["Department", ctx?.encounter?.department], ["Date / time", ctx?.encounter?.date ? new Date(ctx.encounter.date).toLocaleString() : null]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium">{value || "Not recorded"}</dd></div>)}</dl></section>
   <fieldset disabled={working} className="flex flex-wrap gap-2"><button className={button} onClick={newDocument}>New document</button><label className="sr-only" htmlFor="wv-saved">Saved documentation</label><select id="wv-saved" className={button} value={demo ? "" : doc?.id || ""} onChange={event => { const item = documents.find(d => d.id === event.target.value); if (item)
        openDocument(item); }}><option value="">Open saved documentation</option>{documents.filter(d => d.id !== "demo").map(d => <option key={d.id} value={d.id}>{d.template.title} · {d.status} · {new Date(d.created_at).toLocaleDateString()}</option>)}</select><label className="sr-only" htmlFor="wv-demo">Demonstration scenarios</label><select id="wv-demo" className={button} value="" onChange={e => loadDemo(Number(e.target.value))}><option value="">Try isolated demonstration</option>{documentationDemos.map((sample, index) => <option key={sample.name} value={index}>{sample.name}</option>)}</select></fieldset>
   {!doc && <fieldset disabled={working || !canWrite} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3"><label className="text-xs font-semibold">Encounter<select className={input} value={encounter} onChange={e => { setEncounter(e.target.value); const next = context?.encounters.find(item => item.id === e.target.value); if (next) {
        setSpecialty(next.specialty);
        setTemplateId(templates.find(t => t.specialty === next.specialty)?.id || "");
    } }}><option value="">Select existing encounter</option>{context?.encounters.filter(e => !visitId || e.visit_id === visitId).map(e => <option key={e.id} value={e.id}>{e.reference} · {e.department || "General"}</option>)}</select></label><label className="text-xs font-semibold">Specialty<select className={input} value={specialty} onChange={e => { setSpecialty(e.target.value); setTemplateId(templates.find(t => t.specialty === e.target.value)?.id || ""); setFields({}); }}>{[...new Set(templates.map(t => t.specialty))].map(s => <option key={s}>{s}</option>)}</select></label><label className="text-xs font-semibold">Encounter / document type<select className={input} value={templateId} onChange={e => { setTemplateId(e.target.value); setFields({}); }}>{templates.filter(t => t.specialty === specialty).map(t => <option key={t.id} value={t.id}>{t.stage} · {t.title}</option>)}</select></label><p className="text-xs text-slate-500 sm:col-span-3">Specialty is suggested from the encounter department; confirm or change it. {context && !context.encounters.length ? "Create an encounter using the chart's existing New Encounter action first." : ""}</p></fieldset>}
   {template && <><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p className="font-semibold text-teal-800">{template.specialty} / {template.stage} / {template.title}</p><p className="text-slate-500">Destination: {destinationLabels[template.destination]} · {template.version}</p></div>
   <div className="grid items-start gap-5 lg:grid-cols-2">
    <section className="space-y-4 rounded-xl border bg-white p-4"><h3 className="font-semibold">Capture & clinical information</h3>
     {!locked && !demo && <div className="rounded-xl bg-slate-50 p-3"><div className="mb-3 flex justify-between text-xs"><span className="capitalize">{recording === "idle" ? audio ? "Recording ready" : "Ready to dictate" : recording}</span><span className="font-mono">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div><div className="flex flex-wrap gap-2">{recording === "idle" ? <button className={button} disabled={working} onClick={() => void start()}><Icon name="mic" size={14}/>Start recording</button> : <><button className={button} onClick={() => { if (recording === "recording") {
            recorder.current?.pause();
            setRecording("paused");
        }
        else {
            recorder.current?.resume();
            setRecording("recording");
        } }}>{recording === "paused" ? "Resume" : "Pause"}</button><button className={button} onClick={() => recorder.current?.stop()}>Stop</button></>}{audio && recording === "idle" && <button className={primary} disabled={working} onClick={() => void run("Transcribing recording…", async () => { const result = await service.transcribe(patientId, audio); setOriginal(value => [value, result.raw_transcript].filter(Boolean).join("\n")); setTranscript(value => [value, result.translated_text].filter(Boolean).join("\n")); changed(); })}>Transcribe recording</button>}</div>{audioUrl && <audio controls src={audioUrl} className="mt-3 w-full"/>}<p className="mt-2 text-[11px] text-slate-500">Up to 5 minutes per clip. Review the transcript before generating documentation.</p></div>}
     <label className="block text-xs font-semibold">Transcript / clinician dictation<textarea className={`${input} min-h-40`} disabled={locked || working} value={transcript} onChange={e => { setTranscript(e.target.value); changed(); }} placeholder="Dictate or enter the clinician's information. Missing details remain blank."/></label>{original && original !== transcript && <details className="text-xs"><summary className="cursor-pointer text-teal-700">Original-language transcript</summary><p className="mt-2 whitespace-pre-wrap leading-5">{original}</p></details>}
     {!locked && <div className="flex flex-wrap gap-2">{!doc && <button className={button} disabled={working || !encounter} onClick={() => void run("Checking documentation context…", async () => { const suggestion = await service.suggest(patientId, encounter, transcript); if (Object.values(fields).some(value => value.trim()) && !window.confirm("Changing document type clears unsaved fields. Continue?"))
            return; setSpecialty(suggestion.specialty); setTemplateId(suggestion.template_id); setFields({}); setNotice(suggestion.reason); })}>Suggest document type</button>}<button className={primary} disabled={working || !transcript.trim() || (!doc && !encounter)} onClick={() => void generate()}>{doc ? "Regenerate from transcript" : "Generate documentation"}</button><button className={button} disabled={working || (!doc && !encounter)} onClick={() => void run("Saving draft…", async () => { await saved(); setNotice("Draft saved."); })}>Save draft</button></div>}
     <p className="text-xs leading-5 text-slate-500">Generated fields quote clinician-provided information. No independent diagnoses, dose calculations or treatment decisions are added.</p>
     <fieldset disabled={locked || working} className="space-y-4"><legend className="mb-3 font-semibold">Extracted information · review & edit</legend>{template.fields.map(field => <label key={field.key} className="block text-xs font-semibold">{field.label}<span className="ml-2 font-normal text-slate-400">{doc?.fields[field.key]?.source === "dictation" && doc.transcript === transcript && doc.fields[field.key].value === fields[field.key] ? "From dictation" : fields[field.key] ? "Clinician entered" : "Not documented"}</span><textarea rows={2} className={input} value={fields[field.key] || ""} onChange={e => { setFields(current => ({ ...current, [field.key]: e.target.value })); changed(); }}/>{doc?.fields[field.key]?.evidence && <span className="mt-1 block font-normal italic text-slate-500">Source: “{doc.fields[field.key].evidence}”</span>}</label>)}</fieldset>
    </section>
    <section className="space-y-4"><div className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Document preview</h3><label className="text-xs">View<select className={`${input} !mt-0`} disabled={locked || working} value={mode} onChange={e => { setMode(e.target.value as typeof mode); changed(); }}><option value="structured">Structured / synoptic</option><option value="narrative">Narrative</option></select></label></div><div className="mt-4 border-b pb-4 text-xs leading-5 text-slate-500">{ctx?.name} · {ctx?.reference}<br />{ctx?.encounter?.reference} · {ctx?.encounter?.clinician}<br />{template.title}</div><div className="mt-5 space-y-4">{template.fields.map(field => <div key={field.key}>{mode === "structured" ? <><h4 className="text-xs font-semibold uppercase tracking-wide text-teal-800">{field.label}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{fields[field.key] || "Not documented"}</p></> : <p className="whitespace-pre-wrap text-sm leading-6"><strong>{field.label}: </strong>{fields[field.key] || "Not documented"}</p>}</div>)}</div>{doc?.signature && <div className="mt-5 border-t pt-4"><SignatureImage signature={doc.signature}/><p className="text-xs">Signed by {doc.signer_name} · {doc.signed_at ? new Date(doc.signed_at).toLocaleString() : ""}</p><p className="mt-1 text-xs font-semibold text-teal-700">Finalized · {destinationLabels[doc.destination]}</p></div>}</div>
     <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><h3 className="font-semibold">Documentation checks</h3><p className="mt-1 text-xs text-slate-600">Complete the field or explain why it remains undocumented. Acknowledgement does not supply missing clinical information.</p>{checks.length ? checks.map(check => <label key={check.key} className="mt-3 block text-xs font-medium text-amber-900">{check.message}<input aria-label={`Review reason: ${check.message}`} className={input} disabled={locked || working || (doc?.status === "reviewed" && !dirty)} value={ack[check.key] || ""} onChange={e => setAck(current => ({ ...current, [check.key]: e.target.value }))} placeholder="Reason / not applicable, as reviewed"/></label>) : <p className="mt-3 text-sm text-teal-700">Required documentation fields are present. Clinical review is still required.</p>}</div>
     {template.specialty === "Oncology" && <div className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Longitudinal comparison</h3><p className="mt-1 text-xs text-slate-500">Previous finalized encounter versus current documentation</p>{previous ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Field</th><th className="p-2">Previous · {new Date(previous.created_at).toLocaleDateString()}</th><th className="p-2">Current</th></tr></thead><tbody>{template.fields.filter(f => previous.fields[f.key]?.value || fields[f.key]).map(f => <tr key={f.key} className="border-t"><th className="p-2">{f.label}</th><td className="p-2">{previous.fields[f.key]?.value || "Not documented"}</td><td className="p-2">{fields[f.key] || "Not documented"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">No previous finalized oncology encounter available.</p>}</div>}
     {!locked && (canSign || demo) && <div className="space-y-3 rounded-xl border bg-white p-4">{doc?.status !== "reviewed" || dirty ? <button className={primary} disabled={working || (!doc && !encounter) || checks.some(c => (ack[c.key] || "").trim().length < 3)} onClick={() => void review()}>Mark reviewed</button> : <><SignaturePad key={`${doc.id}-${doc.revision}`} label="Doctor signature" onChange={setSignature}/><label className="flex gap-2 text-xs"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)}/>I reviewed this document and the documentation checks and confirm it with my signature.</label><button className={primary} disabled={working || !signature || !confirm} onClick={() => void finalize()}>Sign & finalize</button></>}<p className="text-xs text-slate-500">Finalized documents are locked. External RIS/PACS delivery is not configured; saving here writes to this EMR only.</p></div>}
    </section>
   </div></>}
   {busy && <p role="status" className="sticky bottom-0 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-900">{busy}</p>}
  </div>
 </ClinicalDialog>;
}
