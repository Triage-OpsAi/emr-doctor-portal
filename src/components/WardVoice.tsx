"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Icon } from "@/components/Icon";
import type { FluidChart, WardCountersign, WardVoiceBed, WardVoiceCaptureResult, WardVoiceObservation, WardVoiceOverview, WardVoiceWard } from "@/lib/types";

type WardTab = "rounds" | "capture" | "fluid" | "board" | "handover" | "countersigns" | "compliance";
const tabs: { id: WardTab; label: string }[] = [
  { id: "rounds", label: "Rounds" }, { id: "capture", label: "Capture" },
  { id: "fluid", label: "Fluid charts" }, { id: "board", label: "Ward board" },
  { id: "handover", label: "Handover" }, { id: "countersigns", label: "Countersigns" },
  { id: "compliance", label: "Compliance" },
];
const mono = "font-mono text-[10px] uppercase tracking-[.14em]";

function CapturePanel({ bed, onConfirmed }: { bed: WardVoiceBed | null; onConfirmed: () => void }) {
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<WardVoiceCaptureResult | null>(null);
  const [observations, setObservations] = useState<WardVoiceObservation[]>([]);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function start() {
    if (!bed) return;
    setError(""); setAudio(null); setResult(null); setObservations([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const next = new MediaRecorder(stream);
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = () => {
        setAudio(new Blob(chunks.current, { type: next.mimeType || "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
      };
      next.start();
      recorder.current = next;
      setElapsed(0); setRecording(true);
      timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } catch { setError("Microphone access is required for Ward Voice capture."); }
  }

  function stop() {
    recorder.current?.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null; setRecording(false);
  }

  async function process() {
    if (!bed || !audio) return;
    setProcessing(true); setError("");
    try {
      const contentType = (audio.type || "audio/webm").split(";", 1)[0];
      const upload = await apiFetch<{ capture_id: string; upload_url: string; content_type: string }>("/ward-voice/captures", {
        method: "POST", body: JSON.stringify({ bed_id: bed.id, task_id: null, content_type: contentType, file_size: audio.size, language_code: "unknown" }),
      });
      const sent = await fetch(upload.upload_url, { method: "PUT", headers: { "Content-Type": upload.content_type }, body: audio });
      if (!sent.ok) throw new Error("The recording could not be uploaded.");
      const processed = await apiFetch<WardVoiceCaptureResult>(`/ward-voice/captures/${upload.capture_id}/complete`, {
        method: "POST", body: JSON.stringify({ etag: sent.headers.get("etag") }),
      });
      setResult(processed); setObservations(processed.observations);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to process recording"); }
    finally { setProcessing(false); }
  }

  async function confirm() {
    if (!result) return;
    setProcessing(true); setError("");
    try {
      await apiFetch(`/ward-voice/captures/${result.capture_id}/confirm`, {
        method: "POST", body: JSON.stringify({ observations }),
      });
      setResult(null); setAudio(null); setObservations([]); onConfirmed();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to confirm observations"); }
    finally { setProcessing(false); }
  }

  const title = bed ? `Capture · Bed ${bed.bed_number} · ${bed.patient_name}` : "Capture";
  return (
    <section className="overflow-hidden rounded-2xl border border-[#ddd2ff] bg-white text-[#171226] shadow-sm">
      <header className="flex h-12 items-center justify-between border-b border-[#e9e2ff] px-5">
        <h3 className="text-base font-bold">{title}</h3>
        <span className={`${mono} text-[#c8182b]`}>{recording ? `● REC ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}` : processing ? "Processing…" : "Ready"}</span>
      </header>
      <div className="p-5">
        {!bed ? <p className="py-24 text-center text-sm text-[#777087]">Select a patient to begin bedside capture.</p> : (
          <>
            <div className="py-5 text-center">
              <div className="relative mx-auto grid h-32 w-32 place-items-center">
                <span className={`absolute inset-1 rounded-full border-2 border-[#ded2ff] ${recording ? "animate-ping" : ""}`} />
                <button type="button" onClick={recording ? stop : start} disabled={processing} className={`relative grid h-20 w-20 place-items-center rounded-full text-white shadow-[0_12px_28px_rgba(95,36,199,.35)] ${recording ? "bg-[#c8182b]" : "bg-gradient-to-br from-[#8950ef] to-[#43208d]"}`} aria-label={recording ? "Stop recording" : "Start recording"}>
                  {recording ? <span className="h-5 w-5 rounded bg-white" /> : <Icon name="mic" size={28} />}
                </button>
              </div>
              <p className={`${mono} mt-2 text-[#c8182b]`}>{recording ? "Recording · tap to stop" : audio ? "Recording ready" : "Tap to start bedside capture"}</p>
              {audio && !result && <button type="button" onClick={process} disabled={processing} className="mt-5 rounded-xl bg-[#6d28d9] px-6 py-3 text-sm font-bold text-white">{processing ? "Transcribing and extracting…" : "Process recording"}</button>}
            </div>
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {result && (
              <>
                <div className="rounded-xl bg-[#eee9ff] p-4">
                  <p className={`${mono} text-[#5325a5]`}>Transcript · preserved original</p>
                  <p className="mt-2 text-sm leading-6">{result.translated_text || result.raw_transcript || "No speech detected."}</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {observations.map((item, index) => (
                    <label key={`${item.observation_type}-${index}`} className={`rounded-xl border p-3 ${item.requires_countersign ? "border-amber-500 bg-amber-50" : "border-[#ddd2ff]"}`}>
                      <span className={`${mono} block text-[#625b73]`}>{item.observation_type.replaceAll("_", " ")} {item.unit ? `· ${item.unit}` : ""}</span>
                      <input value={item.value_numeric ?? item.value_text ?? ""} onChange={(event) => setObservations((current) => current.map((entry, position) => position === index ? { ...entry, value_numeric: event.target.value === "" ? null : Number(event.target.value), value_text: null } : entry))} className="mt-1 w-full bg-transparent font-mono text-xl font-bold outline-none" />
                      {item.requires_countersign && <span className={`${mono} text-amber-700`}>Countersign required</span>}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { setResult(null); setAudio(null); void start(); }} className="h-12 rounded-xl border border-[#ddd2ff] font-bold">Re-record</button>
                  <button type="button" onClick={confirm} disabled={processing} className="h-12 rounded-xl bg-[#6d28d9] font-bold text-white">{processing ? "Saving…" : "Confirm → chart"}</button>
                </div>
                <p className={`${mono} mt-3 text-center text-[#777087]`}>Nothing is charted until you confirm</p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FluidCharts({ bed, onChanged }: { bed: WardVoiceBed | null; onChanged: () => void }) {
  const [chart, setChart] = useState<FluidChart | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [showInfusion, setShowInfusion] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (!bed?.patient_id) return;
    apiFetch<FluidChart>(`/ward-voice/fluid-charts/${bed.id}`).then(setChart).catch((reason) => setError(reason.message));
  }, [bed]);
  useEffect(() => { void load(); }, [load]);

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bed) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/ward-voice/fluid-entries", { method: "POST", body: JSON.stringify({
        bed_id: bed.id, direction: form.get("direction"), category: form.get("category"),
        amount_ml: Number(form.get("amount_ml")), occurred_at: new Date(String(form.get("occurred_at"))).toISOString(),
        notes: String(form.get("notes") || "") || null,
      }) });
      setShowEntry(false); load(); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add entry"); }
  }

  async function addInfusion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bed) return;
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/ward-voice/iv-infusions", { method: "POST", body: JSON.stringify({
        bed_id: bed.id, fluid_name: form.get("fluid_name"), rate_ml_per_hour: Number(form.get("rate")),
        started_at: new Date(String(form.get("started_at"))).toISOString(),
      }) });
      setShowInfusion(false); load(); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start infusion"); }
  }

  async function closeChart() {
    if (!bed || !chart || !confirm("Close this 24-hour fluid chart? Closed charts cannot be overwritten.")) return;
    try {
      await apiFetch(`/ward-voice/fluid-charts/${bed.id}/close`, { method: "POST", body: JSON.stringify({ chart_date: chart.chart_date }) });
      load(); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to close chart"); }
  }

  if (!bed) return <div className="mt-5 rounded-2xl border border-[#ddd2ff] bg-white p-16 text-center text-[#777087]">No occupied bed is available for fluid charting.</div>;
  if (!chart) return <div className="mt-5 rounded-2xl border border-[#ddd2ff] bg-white p-16 text-center text-[#777087]">{error || "Loading fluid chart…"}</div>;
  const hours = Array.from({ length: 24 }, (_, index) => index);
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#d9cff7] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div><p className={`${mono} text-[#6d28d9]`}>Fluid chart · 24 hours</p><h2 className="mt-1 text-2xl font-black">{chart.patient_name} · Bed {chart.bed_number}</h2><p className="mt-1 text-xs text-[#777087]">{chart.patient_age ?? "—"} years · {chart.protocol || "Routine fluid monitoring"}</p></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-xl border border-[#d9cff7] px-4 py-2 text-sm font-bold">Print</button>
          <button onClick={() => setShowInfusion(true)} disabled={chart.is_closed} className="rounded-xl border border-[#6d28d9] px-4 py-2 text-sm font-bold text-[#6d28d9] disabled:opacity-40">Start IV</button>
          <button onClick={() => setShowEntry(true)} disabled={chart.is_closed} className="rounded-xl bg-[#6d28d9] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">+ Add entry</button>
        </div>
      </div>
      {error && <p className="mx-5 mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-px bg-[#33264d] p-4 text-white sm:grid-cols-4">
        {[["Intake so far", `${chart.intake_ml} ml`], ["Output so far", `${chart.output_ml} ml`], ["IV running total", `${chart.iv_running_ml} ml`], ["Balance", `${chart.balance_ml >= 0 ? "+" : ""}${chart.balance_ml} ml`]].map(([label, value], index) => <div key={label} className="bg-[#171226] p-3"><p className={mono}>{label}</p><p className={`mt-1 text-xl font-black ${index === 3 ? "text-emerald-400" : ""}`}>{value}</p></div>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-[#e8e1fb] text-[#625b73]"><tr>{["Time", "Nature of fluid", "Oral", "IV", "Vomit", "Drainage", "Urine", "Stool", "Entry"].map((item) => <th key={item} className={`${mono} px-4 py-3`}>{item}</th>)}</tr></thead>
          <tbody>
            {hours.map((hour) => {
              const rows = chart.entries.filter((entry) => new Date(entry.occurred_at).getHours() === hour);
              const item = rows[0];
              const infusion = chart.infusions.find((entry) => new Date(entry.started_at).getHours() <= hour && (!entry.stopped_at || new Date(entry.stopped_at).getHours() >= hour));
              const amount = (category: string) => rows.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount_ml, 0) || "—";
              return <tr key={hour} className="border-b border-[#eee9fb]"><td className="px-4 py-3 font-mono">{`${String(hour).padStart(2, "0")}:00`}</td><td className="px-4 py-3 font-semibold">{item?.notes || item?.category.replaceAll("_", " ") || infusion?.fluid_name || "—"}</td><td className="px-4 py-3">{amount("oral")}</td><td className="px-4 py-3">{infusion ? `${infusion.rate_ml_per_hour}/hr` : amount("iv")}</td><td className="px-4 py-3">{amount("vomit")}</td><td className="px-4 py-3">{amount("drainage")}</td><td className="px-4 py-3">{amount("urine")}</td><td className="px-4 py-3">{amount("stool")}</td><td className="px-4 py-3"><span className="rounded-full bg-[#eee9ff] px-2 py-1 font-mono text-[9px]">{item?.source || (infusion ? "auto" : "—")}</span></td></tr>;
            })}
          </tbody>
          <tfoot><tr className="bg-[#eee9ff] font-bold"><td className="px-4 py-4" colSpan={2}>24-hour total</td><td className="px-4 py-4" colSpan={3}>Intake {chart.intake_ml} ml</td><td className="px-4 py-4" colSpan={3}>Output {chart.output_ml} ml</td><td className="px-4 py-4">Balance {chart.balance_ml >= 0 ? "+" : ""}{chart.balance_ml}</td></tr></tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e1fb] p-4"><p className="text-xs text-[#625b73]">Arithmetic is deterministic: intake − output. IV = rate × elapsed time.</p>{chart.is_closed ? <span className={`${mono} rounded-full bg-emerald-100 px-3 py-2 text-emerald-700`}>Closed</span> : <button onClick={closeChart} className="rounded-xl border border-[#d9cff7] px-4 py-2 text-sm font-bold">Close 24-hour chart</button>}</div>
      {(showEntry || showInfusion) && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:hidden"><form onSubmit={showEntry ? addEntry : addInfusion} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h3 className="text-xl font-bold">{showEntry ? "Add fluid entry" : "Start IV infusion"}</h3><button type="button" onClick={() => { setShowEntry(false); setShowInfusion(false); }}>✕</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
        {showEntry ? <><label className="text-xs">Direction<select name="direction" className="mt-1 h-11 w-full rounded-lg border px-3"><option value="intake">Intake</option><option value="output">Output</option></select></label><label className="text-xs">Category<select name="category" className="mt-1 h-11 w-full rounded-lg border px-3">{["oral", "iv", "vomit", "drainage", "urine", "stool", "other"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs">Amount (ml)<input name="amount_ml" type="number" min="1" required className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs">Time<input name="occurred_at" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs sm:col-span-2">Notes<input name="notes" className="mt-1 h-11 w-full rounded-lg border px-3" /></label></> : <><label className="text-xs sm:col-span-2">Fluid name<input name="fluid_name" required className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs">Rate (ml/hr)<input name="rate" type="number" min="1" required className="mt-1 h-11 w-full rounded-lg border px-3" /></label><label className="text-xs">Started at<input name="started_at" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} className="mt-1 h-11 w-full rounded-lg border px-3" /></label></>}
      </div><button className="mt-5 h-11 w-full rounded-xl bg-[#6d28d9] font-bold text-white">Save to chart</button></form></div>}
    </section>
  );
}

function WardBoard({ data, onOpen }: { data: WardVoiceOverview; onOpen: (bed: WardVoiceBed) => void }) {
  return <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-2xl border border-[#ddd2ff] bg-white xl:col-span-2"><header className="flex items-center justify-between border-b border-[#e8e1fb] p-4"><h2 className="font-bold">Beds — {data.ward_name}, live</h2><span className={mono}>Select a row to open fluid chart</span></header><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead><tr className="border-b border-[#e8e1fb]">{["Bed", "Patient", "Protocol", "Nurse", "Last entry", "Next due", "Fluid balance", "On time", "Status"].map((item) => <th key={item} className={`${mono} px-4 py-3`}>{item}</th>)}</tr></thead><tbody>{data.beds.map((bed) => <tr key={bed.id} onClick={() => onOpen(bed)} className="cursor-pointer border-b border-[#eee9fb] hover:bg-[#faf8ff]"><td className="px-4 py-3 font-bold">{bed.bed_number}</td><td className="px-4 py-3 font-bold">{bed.patient_name || "Available"}</td><td className="px-4 py-3">{bed.protocol || "—"}</td><td className="px-4 py-3">{bed.nurse_name || "Unassigned"}</td><td className="px-4 py-3">{bed.last_entry_at ? new Date(bed.last_entry_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className="px-4 py-3">{bed.next_due_at ? new Date(bed.next_due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td className={`px-4 py-3 font-mono font-bold ${bed.fluid_balance_ml > 0 ? "text-emerald-700" : ""}`}>{bed.fluid_balance_ml >= 0 ? "+" : ""}{bed.fluid_balance_ml} ml</td><td className="px-4 py-3">{bed.completed_tasks}/{bed.total_tasks}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-mono text-[9px] ${bed.status === "on_track" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{bed.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div></section><HandoverPanel data={data} /><CompliancePanel data={data} compact /></div>;
}

function HandoverPanel({ data }: { data: WardVoiceOverview }) {
  return <section className="rounded-2xl border border-[#ddd2ff] bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">Shift handover — live draft</h2><span className={mono}>Traceable to chart</span></div><div className="mt-4 space-y-3">{data.handover.map((line) => <div key={line.bed_id} className="text-sm leading-6"><span className="font-bold text-[#6d28d9]">Bed {line.bed_number} · {line.patient_name}:</span> {line.text}{line.priority !== "routine" && <span className="ml-2 font-bold text-red-600">Action needed</span>}</div>)}{!data.handover.length && <p className="text-sm text-[#777087]">No occupied beds in this ward.</p>}</div><p className="mt-5 text-xs text-[#777087]">Generated only from timestamped Ward Voice records; nurses remain responsible for final handover.</p></section>;
}

function CompliancePanel({ data, compact = false }: { data: WardVoiceOverview; compact?: boolean }) {
  const items = [["On time", `${data.compliance.on_time_percentage}%`], ["Closed by 08:00", `${data.compliance.closed_by_08_percentage}%`], ["IV checks", `${data.compliance.iv_checks_percentage}%`], ["Arithmetic errors", data.compliance.arithmetic_errors]];
  return <section className={`rounded-2xl border border-[#ddd2ff] bg-white ${compact ? "p-5" : "mt-5 p-6"}`}><h2 className="font-bold">Compliance — this ward, live</h2><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(([label, value], index) => <div key={label} className={`rounded-xl border p-4 ${index === 0 ? "border-[#6d28d9] bg-[#6d28d9] text-white" : "border-[#ddd2ff]"}`}><p className={mono}>{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div>{!compact && <div className="mt-5 overflow-hidden rounded-xl border border-[#e8e1fb]"><div className="border-b border-[#e8e1fb] p-4 font-bold">Audit trail</div>{data.audit.map((event) => <div key={event.id} className="grid gap-2 border-b border-[#eee9fb] p-4 text-xs sm:grid-cols-[1fr_1fr_auto]"><span><b>{event.action.replaceAll(".", " ")}</b> · {event.resource_type}</span><span>{event.user_name}</span><time className="font-mono">{new Date(event.created_at).toLocaleString()}</time></div>)}{!data.audit.length && <p className="p-6 text-sm text-[#777087]">No Ward Voice audit events yet.</p>}</div>}</section>;
}

function Countersigns({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<WardCountersign[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(() => apiFetch<WardCountersign[]>("/ward-voice/countersigns").then(setItems).catch((reason) => setMessage(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function sign(id: string) {
    try { await apiFetch(`/ward-voice/countersigns/${id}`, { method: "POST" }); setMessage("Observation countersigned."); load(); onChanged(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Unable to countersign"); }
  }
  return <section className="mt-5 rounded-2xl border border-[#ddd2ff] bg-white p-5"><h2 className="text-xl font-bold">Pending countersigns</h2><p className="mt-1 text-sm text-[#777087]">A second clinician must review values flagged during nurse confirmation.</p>{message && <p className="mt-4 rounded-xl bg-[#eee9ff] p-3 text-sm">{message}</p>}<div className="mt-4 space-y-3">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><div><p className="font-bold">Bed {item.bed_number} · {item.patient_name}</p><p className="mt-1 text-sm">{item.observation_type.replaceAll("_", " ")}: <b>{item.value_numeric ?? item.value_text ?? "—"} {item.unit}</b></p><p className="mt-1 text-xs text-[#777087]">Confirmed by {item.confirmed_by} · {new Date(item.confirmed_at).toLocaleString()}</p></div><button onClick={() => sign(item.id)} className="rounded-xl bg-[#6d28d9] px-4 py-2 text-sm font-bold text-white">Countersign</button></div>)}{!items.length && <p className="py-14 text-center text-sm text-[#777087]">No observations are awaiting countersign.</p>}</div></section>;
}

export function WardVoice() {
  const [tab, setTab] = useState<WardTab>("rounds");
  const [wards, setWards] = useState<WardVoiceWard[]>([]);
  const [data, setData] = useState<WardVoiceOverview | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loadWards = useCallback(() => {
    apiFetch<WardVoiceWard[]>("/ward-voice/wards").then(setWards).catch((reason) => setError(reason.message));
  }, []);
  const load = useCallback(() => {
    if (!selectedWardId) return;
    apiFetch<WardVoiceOverview>(`/ward-voice/overview?ward_id=${encodeURIComponent(selectedWardId)}`)
      .then((value) => {
        setData(value);
        setSelectedBedId((current) => value.beds.some((bed) => bed.id === current) ? current : null);
      })
      .catch((reason) => setError(reason.message));
  }, [selectedWardId]);
  useEffect(() => { void loadWards(); }, [loadWards]);
  useEffect(() => { void load(); }, [load]);
  const selectedBed = data?.beds.find((bed) => bed.id === selectedBedId) || null;
  const selectedWard = wards.find((ward) => ward.id === selectedWardId) || null;

  function openWard(ward: WardVoiceWard) {
    setSelectedWardId(ward.id);
    setSelectedBedId(null);
    setTab("capture");
  }

  function patientList(action: (bed: WardVoiceBed) => void) {
    return (
      <section className="overflow-hidden rounded-2xl border border-[#ddd2ff] bg-white">
        <header className="border-b border-[#e9e2ff] px-5 py-4">
          <h2 className="font-bold">{selectedWard?.name || data?.ward_name || "Select a ward"} patients</h2>
          <p className="mt-1 text-xs text-[#777087]">Choose a patient by bed number</p>
        </header>
        <div className="space-y-2 p-3">
          {data?.beds.filter((bed) => bed.patient_id).map((bed) => (
            <button
              type="button"
              key={bed.id}
              onClick={() => action(bed)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selectedBedId === bed.id
                  ? "border-[#6d28d9] bg-[#eee9ff]"
                  : "border-[#e5def8] hover:border-[#8b5cf6]"
              }`}
            >
              <p className="text-lg font-black">Bed {bed.bed_number}</p>
              <p className="mt-1 font-semibold">{bed.patient_name}</p>
              <p className="mt-1 text-xs text-[#777087]">{bed.patient_age ?? "—"} years · {bed.protocol || "Ward observation"}</p>
            </button>
          ))}
          {selectedWardId && !data?.beds.some((bed) => bed.patient_id) && (
            <p className="py-12 text-center text-sm text-[#777087]">No patients have been assigned to this ward.</p>
          )}
          {!selectedWardId && <p className="py-12 text-center text-sm text-[#777087]">Open a ward from the Rounds tab first.</p>}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f6ff] p-4 text-[#171226] md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className={`${mono} text-[#6d28d9]`}>Ward Voice</p><h1 className="mt-1 text-2xl font-bold">{selectedWard?.name || "Ward workspace"}</h1></div>
          <p className="text-xs text-[#777087]">Voice-assisted nursing · human confirmed</p>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-[#e4dcfa]" aria-label="Ward Voice">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? "border-[#6d28d9] bg-[#eee9ff] text-[#5520b5]" : "border-transparent text-[#625b73]"}`}>{item.label}{item.id === "board" && <span className="ml-2 text-red-600">●</span>}</button>)}
        </nav>
        {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {tab === "rounds" && (
          <section className="mt-5">
            <div className="mb-5"><h2 className="text-xl font-black">Select a ward</h2><p className="mt-1 text-sm text-[#777087]">Only wards assigned to patients are shown.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wards.map((ward) => (
                <button key={ward.id} onClick={() => openWard(ward)} className="aspect-square min-h-48 rounded-3xl border border-[#d7c9ff] bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-[#6d28d9] hover:shadow-xl">
                  <p className={mono}>Ward</p>
                  <p className="mt-8 text-4xl font-black text-[#6d28d9]">{ward.name}</p>
                  <p className="mt-5 text-sm font-semibold">{ward.patient_count} patient{ward.patient_count === 1 ? "" : "s"}</p>
                  <p className={`${mono} mt-2 text-[#777087]`}>{ward.code}</p>
                </button>
              ))}
            </div>
            {!wards.length && !error && <p className="rounded-2xl border border-[#ddd2ff] bg-white py-20 text-center text-sm text-[#777087]">No patients have a ward and bed assignment yet. Open a patient and save both fields.</p>}
          </section>
        )}
        {tab === "capture" && (
          <div className="mt-5 grid gap-4 xl:grid-cols-[380px_1fr]">
            {patientList((bed) => setSelectedBedId(bed.id))}
            <CapturePanel bed={selectedBed} onConfirmed={load} />
          </div>
        )}
        {tab === "fluid" && (
          <div className="mt-5 grid gap-4 xl:grid-cols-[380px_1fr]">
            {patientList((bed) => setSelectedBedId(bed.id))}
            <FluidCharts bed={selectedBed} onChanged={load} />
          </div>
        )}
        {data && tab === "board" && <WardBoard data={data} onOpen={(bed) => { setSelectedBedId(bed.id); setTab("fluid"); }} />}
        {data && tab === "handover" && <div className="mt-5"><HandoverPanel data={data} /></div>}
        {data && tab === "countersigns" && <Countersigns onChanged={load} />}
        {data && tab === "compliance" && <CompliancePanel data={data} />}
      </div>
    </main>
  );
}
