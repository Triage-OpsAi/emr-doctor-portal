"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddMedicationModal, AddRecordModal, Modal, ReportUploadModal, VoiceEncounterModal } from "@/components/PortalApp";
import { Icon, type IconName } from "@/components/Icon";
import { apiFetch, clearTokens, hasSession } from "@/lib/api";
import type { DischargeUpload, PatientChart, PatientDashboardRecord, VoiceJob, Workspace } from "@/lib/types";

/* ---------------------------------------------------------------------- */
/*  Small shared UI primitives                                            */
/* ---------------------------------------------------------------------- */

const actionButton =
  "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dfe7e6] bg-white px-3 text-xs font-semibold text-[#51616b] hover:border-[#0c716e] hover:text-[#0c716e] disabled:opacity-50";

const primaryButton =
  "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0c716e] px-4 text-xs font-semibold text-white hover:bg-[#0a5f5c] disabled:opacity-50";

function points(value?: string | null) {
  if (!value?.trim()) return [];
  return value
    .split(/\n+|;\s+|\.\s+(?=[A-Z])/)
    .map((item) => item.trim().replace(/[.]+$/, ""))
    .filter(Boolean);
}

function PointList({ value, empty = "Not documented" }: { value?: string | null; empty?: string }) {
  const items = points(value);
  if (!items.length) return <p className="text-sm text-[#9aa7ac]">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="grid grid-cols-[16px_1fr] gap-2 text-sm leading-6 text-[#3c4a52]">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#0c716e]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ClinicalSection({ id, title, action, children }: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[#eef2f1] px-5 py-6 first:border-t-0 sm:px-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#18232f]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReportState({ status }: { status: string }) {
  const styles =
    status === "approved"
      ? "bg-emerald-50 text-emerald-600"
      : status === "ready"
        ? "bg-blue-50 text-blue-600"
        : status === "needs_reupload" || status === "failed"
          ? "bg-red-50 text-red-600"
          : "bg-amber-50 text-amber-600";
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${styles}`}>{status.replaceAll("_", " ")}</span>;
}

function HeartbeatLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2.5 text-xs text-rose-600">
      <span className="relative grid h-7 w-7 shrink-0 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/20" />
        <Icon name="activity" size={16} className="relative animate-pulse" />
      </span>
      <span>{label}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Discharge recording modal (unchanged behaviour, restyled)             */
/* ---------------------------------------------------------------------- */

function DischargeRecordingModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setAudio(null);
      chunks.current = [];
      const next = new MediaRecorder(stream);
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      next.onstop = () => {
        const blob = new Blob(chunks.current, { type: next.mimeType || "audio/webm" });
        setAudio(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      next.start();
      recorder.current = next;
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      setRecording(true);
    } catch {
      setError("Microphone permission is required to record discharge instructions.");
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audio) {
      setError("Record the discharge instructions first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const contentType = (audio.type || "audio/webm").split(";", 1)[0];
    setSubmitting(true);
    setError("");
    try {
      setStage("Preparing secure upload…");
      const upload = await apiFetch<DischargeUpload>(`/patients/${patientId}/discharge-summaries`, {
        method: "POST",
        body: JSON.stringify({
          content_type: contentType,
          file_size: audio.size,
          language_code: String(form.get("language_code") || "unknown"),
        }),
      });
      setStage("Uploading instructions…");
      const response = await fetch(upload.upload_url, {
        method: "PUT",
        headers: { "Content-Type": upload.content_type },
        body: audio,
      });
      if (!response.ok) throw new Error(`Instruction upload failed (${response.status}).`);
      setStage("Starting discharge pipeline…");
      await apiFetch(`/patients/${patientId}/discharge-summaries/${upload.job_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ etag: response.headers.get("etag") }),
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start the discharge summary.");
    } finally {
      setSubmitting(false);
      setStage("");
    }
  }

  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <Modal title="Generate discharge summary" subtitle="Record discharge instructions in any supported Indian language. The complete patient chart will be included automatically." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-6">
        <label className="block text-xs text-[#51616b]">
          Instruction language
          <select name="language_code" className="focus-ring mt-2 h-11 w-full rounded-lg border border-[#dfe7e6] bg-white px-3 text-sm">
            <option value="unknown">Detect automatically</option>
            <option value="hi-IN">Hindi</option>
            <option value="kn-IN">Kannada</option>
            <option value="ta-IN">Tamil</option>
            <option value="te-IN">Telugu</option>
            <option value="mr-IN">Marathi</option>
            <option value="bn-IN">Bengali</option>
            <option value="gu-IN">Gujarati</option>
            <option value="ml-IN">Malayalam</option>
            <option value="pa-IN">Punjabi</option>
            <option value="en-IN">English</option>
          </select>
        </label>
        <div className="rounded-xl border border-[#dfe7e6] bg-[#f7f9f9] p-6 text-center">
          <p className="font-mono text-xs text-[#829096]">{recording ? `Recording ${time}` : audio ? "Instructions recorded" : "Ready to record"}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!recording && !audio && (
              <button type="button" onClick={start} className={actionButton}>
                <Icon name="mic" /> Start recording
              </button>
            )}
            {recording && (
              <button type="button" onClick={stop} className="focus-ring rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white">
                Stop recording
              </button>
            )}
            {audio && !recording && (
              <button type="button" onClick={start} className={actionButton}>
                <Icon name="refresh" size={14} /> Record again
              </button>
            )}
          </div>
          {previewUrl && <audio controls src={previewUrl} className="mt-5 w-full" />}
        </div>
        <p className="text-xs leading-5 text-[#51616b]">
          Include medication changes, wound care, diet/activity, follow-up timing, warning signs, and when the patient should return. A clinician-review draft is produced from these instructions plus the EMR, reports, and medication history.
        </p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={actionButton}>
            Cancel
          </button>
          <button disabled={!audio || submitting} className={primaryButton}>
            {submitting ? stage : "Generate discharge summary"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Vitals + medication-mix helpers (presentational only)                 */
/* ---------------------------------------------------------------------- */

type VitalReading = { label: string; value: string; unit?: string };

// Vitals aren't part of the current PatientChart type. Read them defensively
// so the UI matches the reference design once the API starts returning them,
// without fabricating numbers today.
function readVitals(chart: PatientChart | null): VitalReading[] {
  const raw = (chart as unknown as { vitals?: Record<string, string | number> } | null)?.vitals;
  const fields: Array<[string, string, string?]> = [
    ["bp", "BP", "mmHg"],
    ["hr", "HR", "bpm"],
    ["spo2", "SpO₂", "%"],
    ["rr", "RR", "breaths/min"],
    ["temp", "Temp", "°C"],
    ["pain_score", "Pain Score", undefined],
  ];
  return fields.map(([key, label, unit]) => ({
    label,
    unit,
    value: raw && raw[key] != null ? String(raw[key]) : "—",
  }));
}

const MEDICATION_CATEGORIES: Array<{ label: string; test: RegExp; color: string }> = [
  { label: "Antiplatelet", test: /aspirin|clopidogrel|ticagrelor|prasugrel/i, color: "#14b8a6" },
  { label: "Statin", test: /statin/i, color: "#f59e0b" },
  { label: "Beta Blocker", test: /olol\b/i, color: "#6366f1" },
  { label: "ACE Inhibitor", test: /pril\b|sartan\b/i, color: "#f97316" },
];

// Heuristic grouping from the medication name only — good enough for a mix
// chart, but not a substitute for a real `category` field from the API.
function categorizeMedications(names: string[]) {
  const counts = new Map<string, { count: number; color: string }>();
  let others = 0;
  for (const name of names) {
    const match = MEDICATION_CATEGORIES.find((category) => category.test.test(name));
    if (match) {
      const existing = counts.get(match.label) || { count: 0, color: match.color };
      counts.set(match.label, { count: existing.count + 1, color: match.color });
    } else {
      others += 1;
    }
  }
  const entries = Array.from(counts.entries()).map(([label, value]) => ({ label, ...value }));
  if (others) entries.push({ label: "Others", count: others, color: "#94a3b8" });
  return entries;
}

function MedicationDonut({ names }: { names: string[] }) {
  const segments = useMemo(() => categorizeMedications(names), [names]);
  const total = names.length;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#eef2f1" strokeWidth="14" />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.count / total) * circumference;
            const dasharray = `${length} ${circumference - length}`;
            const circle = (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" className="rotate-90" style={{ transformOrigin: "60px 60px" }}>
          <tspan x="60" dy="-4" className="fill-[#18232f] text-[22px] font-bold" style={{ fontFamily: "inherit" }}>
            {total}
          </tspan>
          <tspan x="60" dy="18" className="fill-[#9aa7ac] text-[9px] font-semibold uppercase tracking-wide">
            Total
          </tspan>
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {segments.length ? (
          segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-3 text-[#51616b]">
              <span className="flex items-center gap-2 truncate">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
              <span className="font-semibold text-[#18232f]">{segment.count}</span>
            </li>
          ))
        ) : (
          <li className="text-[#9aa7ac]">No medications yet</li>
        )}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Main page                                                              */
/* ---------------------------------------------------------------------- */

const SIDEBAR_LINKS: Array<{ label: string; icon: string; href: string; badge?: (n: { orders: number; reports: number }) => number | undefined }> = [
  { label: "Overview", icon: "home", href: "#visit" },
  { label: "Encounters", icon: "activity", href: "#consults" },
  { label: "Clinical Notes", icon: "file", href: "#emr-summary" },
  { label: "Orders", icon: "library", href: "#orders", badge: (n) => n.orders },
  { label: "Medications", icon: "pill", href: "#orders" },
  { label: "Diagnostics", icon: "activity", href: "#reports" },
  { label: "Reports", icon: "file", href: "#reports", badge: (n) => n.reports },
  { label: "Discharge Summary", icon: "mic", href: "#discharge" },
  { label: "EMR Records", icon: "file", href: "#emr-summary" },
];

const TOP_TABS = [
  { id: "summary", label: "Summary" },
  { id: "timeline", label: "Timeline" },
  { id: "clinical", label: "Clinical Details" },
  { id: "medications", label: "Medications" },
  { id: "diagnoses", label: "Diagnoses" },
  { id: "reports", label: "Reports" },
  { id: "documents", label: "Documents" },
] as const;

type PatientTab = (typeof TOP_TABS)[number]["id"];

function EditPatientModal({
  patient,
  onClose,
  onDone,
}: {
  patient: PatientDashboardRecord;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/patients/${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: String(form.get("full_name") || ""),
          phone: String(form.get("phone") || "") || null,
          gender: String(form.get("gender") || "") || null,
          encounter_number: String(form.get("encounter_number") || "") || null,
          ward_number: String(form.get("ward_number") || "") || null,
          bed_number: String(form.get("bed_number") || "") || null,
        }),
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update patient details.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Edit patient details" subtitle="Update patient identity and current encounter location." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Patient name<input name="full_name" required defaultValue={patient.patient_name} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <label className="text-xs text-[var(--muted)]">Phone<input name="phone" defaultValue={patient.phone || ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <label className="text-xs text-[var(--muted)]">Gender<select name="gender" defaultValue={patient.gender || ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm"><option value="">Not recorded</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        <label className="text-xs text-[var(--muted)]">Encounter number<input name="encounter_number" defaultValue={patient.encounter_number || ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <label className="text-xs text-[var(--muted)]">Ward number<input name="ward_number" defaultValue={patient.ward_number || ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <label className="text-xs text-[var(--muted)]">Bed number<input name="bed_number" defaultValue={patient.bed_number || ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-xs text-[var(--danger)] sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className={actionButton}>Cancel</button><button disabled={submitting} className="focus-ring rounded-lg bg-[var(--teal)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{submitting ? "Saving…" : "Save details"}</button></div>
      </form>
    </Modal>
  );
}

export function PatientPage({ clientName, workspaceId, patientId }: { clientName: string; workspaceId: string; patientId: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [patient, setPatient] = useState<PatientDashboardRecord | null>(null);
  const [chart, setChart] = useState<PatientChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"report" | "record" | "voice-encounter" | "medication" | "discharge" | "edit-patient" | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState("");
  const [approving, setApproving] = useState("");
  const [activeTab, setActiveTab] = useState<PatientTab>("summary");
  const [encounterQueued, setEncounterQueued] = useState(false);

  const workspacePath = `/${clientName}/${workspaceId}`;

  const load = useCallback(async () => {
    try {
      setError("");
      const [workspaceData, patients, chartData] = await Promise.all([
        apiFetch<Workspace>("/doctor/workspace"),
        apiFetch<PatientDashboardRecord[]>("/doctor/patients"),
        apiFetch<PatientChart>(`/patients/${patientId}/chart`),
      ]);
      const selected = patients.find((item) => item.id === patientId);
      if (!selected) throw new Error("Patient was not found in this hospital.");
      setWorkspace(workspaceData);
      setPatient(selected);
      setChart(chartData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load this patient.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (!hasSession()) {
      router.replace("/login");
      return;
    }
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, [load, router]);

  useEffect(() => {
    const reportPending = chart?.reports.some((report) => ["queued", "processing"].includes(report.status));
    const dischargePending = chart?.discharge_summaries.some((job) => ["queued", "transcribing", "generating_summary", "generating_pdf"].includes(job.status));
    if (!reportPending && !dischargePending) return;
    const handle = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(handle);
  }, [chart?.discharge_summaries, chart?.reports, load]);

  useEffect(() => {
    if (!encounterQueued) return;
    const check = async () => {
      await load();
      const jobs = await apiFetch<VoiceJob[]>("/emr/voice-jobs").catch(() => []);
      const pending = jobs.find((job) => job.patient_id === patientId && !["ready", "failed"].includes(job.status));
      if (!pending) setEncounterQueued(false);
    };
    const handle = window.setInterval(() => void check(), 3000);
    return () => window.clearInterval(handle);
  }, [encounterQueued, load, patientId]);

  const latest = chart?.records[0] || null;
  const note = latest?.structured_note || null;
  const diagnosisPoints = useMemo(() => (note?.diagnoses?.length ? note.diagnoses : points(note?.assessment)), [note]);
  const orders = useMemo(() => {
    if (!chart) return [];
    const entered = chart.medications.map((medication) => ({
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage || "—",
      frequency: medication.frequency || "—",
      duration: medication.duration || "—",
      status: medication.is_active ? "Ordered" : "Stopped",
    }));
    const generated = (note?.medications || [])
      .filter((medication) => !entered.some((item) => item.name.toLowerCase() === medication.name.toLowerCase()))
      .map((medication, index) => ({
        id: `emr-${index}`,
        name: medication.name,
        dosage: medication.dosage || "—",
        frequency: medication.frequency || "—",
        duration: "—",
        status: "Documented",
      }));
    return [...entered, ...generated];
  }, [chart, note]);
  const treatmentPoints = useMemo(() => {
    const planItems = points(note?.plan);
    if (planItems.length) return planItems;
    return orders.map((order) => [order.name, order.dosage, order.frequency].filter((value) => value && value !== "—").join(" · "));
  }, [note?.plan, orders]);
  const treatmentSections = useMemo(() => {
    const groups = [
      { title: "Medications & Acute Management", icon: "pill" as IconName, tone: "emerald", items: [] as string[] },
      { title: "Monitoring", icon: "activity" as IconName, tone: "sky", items: [] as string[] },
      { title: "Lifestyle & Rehabilitation", icon: "users" as IconName, tone: "amber", items: [] as string[] },
      { title: "Follow-up & Investigations", icon: "file" as IconName, tone: "violet", items: [] as string[] },
      { title: "Other Care Instructions", icon: "shield" as IconName, tone: "slate", items: [] as string[] },
    ];
    for (const item of treatmentPoints) {
      const value = item.toLowerCase();
      if (/follow[- ]?up|repeat|echo|echocardi|lipid|investigat|review|appointment/.test(value)) groups[3].items.push(item);
      else if (/rehab|exercise|smok|diet|salt|fat|lifestyle|activity/.test(value)) groups[2].items.push(item);
      else if (/monitor|blood pressure|blood glucose|glycemic|vital|observe|check/.test(value)) groups[1].items.push(item);
      else if (/aspirin|ticagrelor|statin|heparin|blocker|inhibitor|nitrate|insulin|proton pump|medicat|tablet|infusion|therapy|dose/.test(value)) groups[0].items.push(item);
      else groups[4].items.push(item);
    }
    return groups.filter((group) => group.items.length);
  }, [treatmentPoints]);

  const vitals = useMemo(() => readVitals(chart), [chart]);
  const recentReports = useMemo(() => [...(chart?.reports || [])].slice(0, 3), [chart]);

  async function listen(recordId: string) {
    setAudioLoading(recordId);
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/records/${recordId}/audio`);
      setAudioUrl(access.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retrieve the recording.");
    } finally {
      setAudioLoading("");
    }
  }

  async function listenDischarge(jobId: string) {
    setAudioLoading(jobId);
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/discharge-summaries/${jobId}/audio`);
      setAudioUrl(access.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retrieve discharge instructions.");
    } finally {
      setAudioLoading("");
    }
  }

  async function downloadDischarge(jobId: string) {
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/discharge-summaries/${jobId}/download`);
      window.open(access.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to download the discharge PDF.");
    }
  }

  async function approveRecord(recordId: string) {
    setApproving(`record-${recordId}`);
    setError("");
    try {
      await apiFetch(`/emr/records/${recordId}/review`, { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve the patient record.");
    } finally {
      setApproving("");
    }
  }

  async function approveReport(reportId: string) {
    setApproving(`report-${reportId}`);
    setError("");
    try {
      await apiFetch(`/patients/${patientId}/reports/${reportId}/approve`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve the report summary.");
    } finally {
      setApproving("");
    }
  }

  async function openReport(reportId: string) {
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/reports/${reportId}/open`);
      window.open(access.url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open this report.");
    }
  }

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f9f9] text-sm text-[#51616b]">Loading patient chart…</main>;
  }

  if (!workspace || !patient || !chart) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f9f9] p-6">
        <div className="max-w-lg rounded-xl border border-[#dfe7e6] bg-white p-8 text-center">
          <p className="text-red-600">{error || "Patient chart unavailable."}</p>
          <button onClick={() => router.push(workspacePath)} className={`${actionButton} mt-5`}>
            Back to patient list
          </button>
        </div>
      </main>
    );
  }

  const isApproved = Boolean(latest && latest.status !== "pending_review");

  return (
    <div className="min-h-screen bg-[#f7f9f9] text-[#18232f]">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-[#e3e9e8] bg-white px-5 md:px-7">
        <div className="flex min-w-0 items-center gap-5">
          <button onClick={() => router.push(workspacePath)} className="focus-ring flex items-center gap-3 rounded-md text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0d7778] to-[#36c99e] text-xl font-bold text-white">+</span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold leading-tight">Meridian Health AI</span>
              <span className="mt-0.5 block text-[8px] uppercase tracking-[.18em] text-[#829096]">Doctor portal</span>
            </span>
          </button>
          <span className="hidden h-7 w-px bg-[#e3e9e8] md:block" />
          <details className="hidden md:block">
            <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-md text-left">
              <div>
                <p className="truncate text-xs font-semibold">{workspace.organization.name}</p>
                <p className="mt-0.5 text-[9px] text-[#829096]">{workspace.organization.code}</p>
              </div>
              <Icon name="chevron" size={12} className="rotate-90 text-[#829096]" />
            </summary>
          </details>
        </div>

        <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-[#e3e9e8] bg-[#f7f9f9] px-3 py-2 text-xs text-[#9aa7ac] lg:flex">
          <Icon name="search" size={14} />
          <span className="flex-1 truncate">Search patient, visit, report…</span>
          <span className="rounded border border-[#e3e9e8] bg-white px-1.5 py-0.5 font-mono text-[9px] text-[#9aa7ac]">⌘K</span>
        </div>

        <div className="flex items-center gap-4">
          <button className="focus-ring relative rounded-md p-2 text-[#66757a]" aria-label="Notifications">
            <Icon name="bell" size={17} />
          </button>
          <button className="focus-ring relative rounded-md p-2 text-[#66757a]" aria-label="Messages">
            <Icon name="message-circle" size={17} />
          </button>
          <button className="focus-ring hidden rounded-md p-2 text-[#66757a] sm:block" aria-label="Help">
            <Icon name="help-circle" size={17} />
          </button>
          <details className="relative">
            <summary className="focus-ring flex cursor-pointer list-none items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dff4ec] text-sm font-bold text-[#16846e]">{workspace.current_user.full_name.slice(0, 1)}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold">{workspace.current_user.full_name}</span>
                <span className="block text-[10px] capitalize text-[#829096]">{workspace.current_user.role}</span>
              </span>
              <Icon name="chevron" size={12} className="hidden rotate-90 text-[#829096] sm:block" />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-[#e3e9e8] bg-white p-2 shadow-2xl">
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                <Icon name="logout" size={15} /> Logout
              </button>
            </div>
          </details>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1760px] md:grid-cols-[230px_1fr]">
        {/* -------------------------------------------------------------- */}
        {/* Sidebar                                                        */}
        {/* -------------------------------------------------------------- */}
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] flex-col justify-between overflow-y-auto border-r border-[#e3e9e8] bg-white p-4 md:flex">
          <nav className="space-y-1 text-xs">
            {SIDEBAR_LINKS.map((link, index) => (
              <a
                key={link.label}
                href={link.href}
                className={
                  index === 0
                    ? "flex items-center justify-between gap-3 rounded-lg bg-[#075e61] px-3 py-3 font-semibold text-white"
                    : "flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-[#51616b] hover:bg-[#eef5f3]"
                }
              >
                <span className="flex items-center gap-3">
                  <Icon name={link.icon as IconName} size={16} /> {link.label}
                </span>
                {link.badge && link.badge({ orders: orders.length, reports: chart.reports.length }) ? (
                  <span className={index === 0 ? "text-[10px] text-white/80" : "text-[10px] text-[#9aa7ac]"}>{link.badge({ orders: orders.length, reports: chart.reports.length })}</span>
                ) : null}
              </a>
            ))}
            <span className="flex cursor-default items-center gap-3 rounded-lg px-3 py-3 text-[#c2ccce]">
              <Icon name="activity" size={16} /> Analytics
              <span className="ml-auto rounded bg-[#f2f5f4] px-1.5 py-0.5 text-[8px] font-semibold uppercase text-[#9aa7ac]">Soon</span>
            </span>
            <button onClick={() => router.push(workspacePath)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[#51616b] hover:bg-[#eef5f3]">
              <Icon name="users" size={16} /> Patients
            </button>
          </nav>

          <div className="mt-6 space-y-3">
            <div className="rounded-xl bg-gradient-to-br from-[#0d7778] to-[#1f9d84] p-4 text-white">
              <p className="text-xs font-bold">AI Assistant</p>
              <p className="mt-1.5 text-[10px] leading-4 text-white/80">Ask AI to summarize records, suggest diagnosis, and more.</p>
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-[10px] font-semibold hover:bg-white/25">
                <Icon name="activity" size={13} /> Open Assistant
              </button>
            </div>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#eef5f3]">
              <Icon name="settings" size={15} /> Settings
            </button>
          </div>
        </aside>

        {/* -------------------------------------------------------------- */}
        {/* Main content                                                   */}
        {/* -------------------------------------------------------------- */}
        <main className="min-w-0 bg-[#f7f9f9] p-3 sm:p-5 lg:p-7">
          <button onClick={() => router.push(workspacePath)} className="focus-ring mb-4 flex items-center gap-2 text-xs font-semibold text-[#51616b] hover:text-[#0c716e]">
            <Icon name="chevron" size={13} className="rotate-180" /> Back to patients
          </button>

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            {/* Primary card ------------------------------------------------ */}
            <div className="overflow-hidden rounded-xl border border-[#dfe7e6] bg-white shadow-[0_6px_24px_rgba(35,58,55,.05)]">
              <div id="visit" className="scroll-mt-24 px-5 py-5 sm:px-7">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                  <div className="flex gap-4">
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#eef5f3] text-2xl font-semibold text-[#0c716e]">{patient.patient_name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-base font-bold">{patient.patient_name}</h1>
                        {isApproved && <Icon name="shield" size={15} className="text-[#16846e]" />}
                      </div>
                      <p className="mt-1 text-xs text-[#829096]">
                        {patient.gender || "Gender not recorded"} · Age {patient.age ?? "—"} · ID {patient.patient_reference}
                      </p>
                      <div className="mt-3 grid gap-x-7 gap-y-1.5 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          <span className="text-[#9aa7ac]">Visit Number:</span> {patient.encounter_number || latest?.encounter_id.slice(0, 10).toUpperCase() || "—"}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Visit Date &amp; Time:</span> {patient.last_visit_at ? new Date(patient.last_visit_at).toLocaleString() : "—"}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Care Provider:</span> {patient.doctor_name || workspace.current_user.full_name}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Ward / Bed:</span> {patient.ward_number || "—"} / {patient.bed_number || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <button onClick={() => setAction("voice-encounter")} className={primaryButton}>
                      <Icon name="plus" size={14} /> New Encounter
                    </button>
                    <details className="relative">
                      <summary className={`${actionButton} cursor-pointer list-none bg-white`}>
                        Actions <Icon name="chevron" size={13} className="rotate-90" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#e3e9e8] bg-white p-2 shadow-2xl">
                        {latest?.status === "pending_review" && (
                          <button onClick={() => approveRecord(latest.id)} disabled={Boolean(approving)} className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                            <Icon name="shield" size={15} /> {approving === `record-${latest.id}` ? "Approving…" : "Approve patient record"}
                          </button>
                        )}
                        {latest?.audio_available && (
                          <button onClick={() => listen(latest.id)} disabled={Boolean(audioLoading)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9] disabled:opacity-50">
                            <Icon name="play" size={15} /> {audioLoading ? "Getting audio…" : "Listen recording"}
                          </button>
                        )}
                        <button onClick={() => setAction("edit-patient")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                          <Icon name="file" size={15} /> Edit patient &amp; location
                        </button>
                        <button onClick={() => setAction("report")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                          <Icon name="upload" size={15} /> Upload report
                        </button>
                        <button onClick={() => setAction("medication")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                          <Icon name="pill" size={15} /> Add medication
                        </button>
                        <button onClick={() => setAction("discharge")} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                          <Icon name="mic" size={15} /> Generate discharge summary
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                <nav className="mt-5 flex gap-6 overflow-x-auto border-b border-[#e3e9e8] text-xs text-[#65747a]">
                  {TOP_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={activeTab === tab.id ? "whitespace-nowrap border-b-2 border-[#0c716e] pb-3 font-semibold text-[#0c716e]" : "whitespace-nowrap pb-3 hover:text-[#0c716e]"}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>

                <div className={activeTab === "summary" ? "mt-5 grid gap-3 md:grid-cols-3" : "hidden"}>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-rose-500">
                      <Icon name="activity" size={13} /> Chief Complaint
                    </div>
                    <p className="mt-2 text-sm leading-5">{note?.chief_complaint || patient.subject || "Not documented"}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-violet-500">
                      <Icon name="file" size={13} /> Primary Diagnosis
                    </div>
                    <p className="mt-2 text-sm leading-5">{diagnosisPoints[0] || "Not documented"}</p>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-sky-600">
                      <Icon name="shield" size={13} /> Status
                    </div>
                    <p className="mt-2 text-sm font-semibold capitalize">{latest?.status.replaceAll("_", " ") || patient.status.replaceAll("_", " ")}</p>
                  </div>
                </div>

                <section className={activeTab === "summary" ? "mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5" : "hidden"}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="pill" size={17} /></span>
                    <div><h2 className="text-sm font-bold text-emerald-900">Treatment Plan</h2><p className="mt-0.5 text-[10px] text-emerald-700">Structured by clinical purpose for quick review</p></div>
                  </div>
                  {treatmentSections.length ? (
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {treatmentSections.map((section) => {
                        const tones: Record<string, string> = {
                          emerald: "border-emerald-100 bg-white text-emerald-700",
                          sky: "border-sky-100 bg-white text-sky-700",
                          amber: "border-amber-100 bg-white text-amber-700",
                          violet: "border-violet-100 bg-white text-violet-700",
                          slate: "border-slate-200 bg-white text-slate-700",
                        };
                        return (
                          <article key={section.title} className={`rounded-xl border p-4 ${tones[section.tone]}`}>
                            <h3 className="flex items-center gap-2 text-xs font-bold"><Icon name={section.icon} size={15} /> {section.title}<span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[9px]">{section.items.length}</span></h3>
                            <ul className="mt-3 space-y-2.5">
                              {section.items.map((item, index) => (
                                <li key={`${item}-${index}`} className="grid grid-cols-[8px_1fr] gap-2 text-sm leading-5 text-[#26353b]"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#19a77e]" /><span>{item}</span></li>
                              ))}
                            </ul>
                          </article>
                        );
                      })}
                    </div>
                  ) : <p className="mt-4 text-sm text-[#9aa7ac]">No treatment plan documented.</p>}
                </section>

                {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</p>}
                {audioUrl && (
                  <div className="mt-5 rounded-lg border border-[#dfe7e6] bg-[#f7f9f9] p-4">
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wide text-[#0c716e]">Original consultation recording · private link</p>
                    <audio controls autoPlay src={audioUrl} className="w-full" />
                  </div>
                )}

                <div className={activeTab === "summary" ? "mt-6 grid gap-4 lg:grid-cols-2" : "hidden"}>
                  <div className="rounded-2xl border border-[#e3e9e8] p-5">
                    <h3 className="mb-3 text-sm font-bold">Clinical Summary</h3>
                    <PointList value={note?.subjective || note?.assessment} empty="No clinical summary documented." />
                  </div>
                  <div className="rounded-2xl border border-[#e3e9e8] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold">Patient Vitals (Latest)</h3>
                      <button type="button" onClick={() => setActiveTab("clinical")} className="text-[10px] font-semibold text-[#0c716e]">
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {vitals.map((vital) => (
                        <div key={vital.label} className="rounded-xl bg-[#f7f9f9] p-3">
                          <p className="text-[10px] text-[#9aa7ac]">{vital.label}</p>
                          <p className="mt-1 text-base font-bold">{vital.value}</p>
                          {vital.unit && <p className="text-[9px] text-[#9aa7ac]">{vital.unit}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={activeTab === "summary" ? "mt-4 grid gap-4 lg:grid-cols-2" : "hidden"}>
                  <div className="rounded-2xl border border-[#e3e9e8] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold">Active Diagnoses</h3>
                      <button type="button" onClick={() => setActiveTab("diagnoses")} className="text-[10px] font-semibold text-[#0c716e]">
                        View all
                      </button>
                    </div>
                    {diagnosisPoints.length ? (
                      <ol className="space-y-2">
                        {diagnosisPoints.slice(0, 5).map((item, index) => (
                          <li key={item} className="grid grid-cols-[22px_1fr] text-sm">
                            <span className="font-mono text-[#9aa7ac]">{index + 1}</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-[#9aa7ac]">No diagnosis documented.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[#e3e9e8] p-5">
                    <h3 className="mb-3 text-sm font-bold">Allergies &amp; Risk Factors</h3>
                    <p className="text-[10px] font-semibold text-red-500">Allergies</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-[#51616b]">
                      <Icon name="shield" size={13} /> No known drug allergies
                    </p>
                    {note?.symptoms && note.symptoms.length > 0 && (
                      <>
                        <p className="mt-4 text-[10px] font-semibold text-[#829096]">Risk Factors</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {note.symptoms.map((symptom) => (
                            <span key={symptom} className="rounded-full bg-[#eef5f3] px-2.5 py-1 text-[10px] font-medium text-[#0c716e]">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {activeTab === "timeline" && <ClinicalSection id="consults" title="Timeline · IPD Consults">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-y border-[#eef2f1] bg-[#f7f9f9] text-[#9aa7ac]">
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Consultation</th>
                        <th className="px-3 py-2 font-semibold">Assessment</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Recording</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chart.records.map((record) => (
                        <tr key={record.id} className="border-b border-[#eef2f1]">
                          <td className="px-3 py-3">{new Date(record.created_at).toLocaleString()}</td>
                          <td className="px-3 py-3 font-medium">{record.structured_note?.chief_complaint || "Clinical consultation"}</td>
                          <td className="max-w-md px-3 py-3 text-[#51616b]">{record.structured_note?.assessment || "Not documented"}</td>
                          <td className="px-3 py-3 uppercase text-[#0c716e]">{record.status.replaceAll("_", " ")}</td>
                          <td className="px-3 py-3">{record.audio_available ? <button onClick={() => listen(record.id)} className="text-[#0c716e] hover:underline">Listen</button> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ClinicalSection>}

              {activeTab === "diagnoses" && <ClinicalSection id="diagnosis" title="Diagnoses">
                {diagnosisPoints.length ? (
                  <ol className="space-y-2">
                    {diagnosisPoints.map((item, index) => (
                      <li key={item} className="grid grid-cols-[24px_1fr] text-sm">
                        <span className="font-mono text-[#9aa7ac]">{index + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-[#9aa7ac]">No diagnosis documented.</p>
                )}
              </ClinicalSection>}

              {activeTab === "medications" && <ClinicalSection id="orders" title="Medications &amp; Orders" action={<button onClick={() => setAction("medication")} className={actionButton}><Icon name="plus" size={13} /> Add medication</button>}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-y border-[#eef2f1] bg-[#f7f9f9] text-[#9aa7ac]">
                        <th className="w-12 px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Medication / order</th>
                        <th className="px-3 py-2 font-semibold">Dose</th>
                        <th className="px-3 py-2 font-semibold">Frequency</th>
                        <th className="px-3 py-2 font-semibold">Duration</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => (
                        <tr key={order.id} className="border-b border-[#eef2f1]">
                          <td className="px-3 py-3 font-mono text-[#9aa7ac]">{index + 1}</td>
                          <td className="px-3 py-3 font-semibold uppercase">{order.name}</td>
                          <td className="px-3 py-3">{order.dosage}</td>
                          <td className="px-3 py-3">{order.frequency}</td>
                          <td className="px-3 py-3">{order.duration}</td>
                          <td className="px-3 py-3 text-[#0c716e]">{order.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!orders.length && <p className="py-4 text-sm text-[#9aa7ac]">No medication orders documented.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "reports" && <ClinicalSection id="reports" title="Diagnostics &amp; Uploaded Reports" action={<button onClick={() => setAction("report")} className={actionButton}><Icon name="upload" size={13} /> Upload report</button>}>
                <div className="space-y-3">
                  {chart.reports.map((report) => (
                    <article key={report.id} className="rounded-xl border border-[#e3e9e8] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold">{report.title}</h3>
                          <p className="mt-1 text-[10px] text-[#9aa7ac]">
                            {report.document_type || "Clinical report"} · {new Date(report.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openReport(report.id)} className="focus-ring rounded-lg border border-[#dfe7e6] px-3 py-2 text-xs font-semibold text-[#0c716e] hover:bg-[#eef5f3]">
                            Open report
                          </button>
                          {report.status === "ready" && (
                            <button onClick={() => approveReport(report.id)} disabled={Boolean(approving)} className="focus-ring rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                              {approving === `report-${report.id}` ? "Approving…" : "Approve summary"}
                            </button>
                          )}
                          <ReportState status={report.status} />
                        </div>
                      </div>
                      {report.status === "ready" && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-600">Review this generated summary and approve it before it can be included in a discharge summary.</p>}
                      {report.status === "approved" && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-600">Approved for inclusion in future discharge summaries.</p>}
                      {report.status === "needs_reupload" && (
                        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-600">
                          <strong>Image not readable. Click the picture again.</strong>
                          <p className="mt-1">{report.quality_message}</p>
                          <button onClick={() => setAction("report")} className="mt-2 underline">
                            Upload clearer image
                          </button>
                        </div>
                      )}
                      {["queued", "processing"].includes(report.status) && (
                        <div className="mt-3">
                          <HeartbeatLoader label={report.status === "processing" ? "Reading the document and generating a structured report…" : "Report generation queued…"} />
                        </div>
                      )}
                      {report.summary && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase text-[#9aa7ac]">Summary</p>
                          <PointList value={report.summary} />
                          {report.key_findings.length > 0 && (
                            <div className="mt-4">
                              <p className="mb-2 text-xs font-semibold uppercase text-[#9aa7ac]">Key findings</p>
                              <ul className="space-y-2">
                                {report.key_findings.map((finding) => (
                                  <li key={finding} className="grid grid-cols-[18px_1fr] text-sm">
                                    <span className="text-[#0c716e]">•</span>
                                    <span>{finding}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {!chart.reports.length && <p className="text-sm text-[#9aa7ac]">No reports uploaded.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "documents" && <ClinicalSection id="discharge" title="Discharge Summaries &amp; Documents" action={<button onClick={() => setAction("discharge")} className={actionButton}><Icon name="mic" size={13} /> Record instructions</button>}>
                <div className="space-y-4">
                  {chart.discharge_summaries.map((job) => {
                    const data = job.summary_data || {};
                    const section = (key: string) => (Array.isArray(data[key]) ? (data[key] as string[]) : []);
                    return (
                      <article key={job.id} className="rounded-xl border border-[#e3e9e8] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">Discharge summary draft</h3>
                            <p className="mt-1 text-[10px] text-[#9aa7ac]">
                              {new Date(job.created_at).toLocaleString()} · {job.source_language === "unknown" ? "Language auto-detected" : job.source_language}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {job.audio_available && (
                              <button onClick={() => listenDischarge(job.id)} className={actionButton}>
                                <Icon name="play" size={13} /> Listen instructions
                              </button>
                            )}
                            {job.pdf_available && (
                              <button onClick={() => downloadDischarge(job.id)} className={actionButton}>
                                <Icon name="download" size={13} /> Download PDF
                              </button>
                            )}
                          </div>
                        </div>
                        {["queued", "transcribing", "generating_summary", "generating_pdf"].includes(job.status) && (
                          <div className="mt-4">
                            <HeartbeatLoader
                              label={
                                job.status === "transcribing"
                                  ? "Listening and translating discharge instructions…"
                                  : job.status === "generating_summary"
                                    ? "Combining EMR, reports, medications, and instructions…"
                                    : job.status === "generating_pdf"
                                      ? "Rendering and securely saving the discharge PDF…"
                                      : "Discharge workflow queued…"
                              }
                            />
                          </div>
                        )}
                        {job.status === "failed" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{job.error_message || "Discharge summary generation failed."}</p>}
                        {job.translated_instructions && (
                          <details className="mt-4 rounded-lg border border-[#e3e9e8] bg-[#f7f9f9]">
                            <summary className="cursor-pointer p-3 text-xs font-semibold">Translated recorded instructions</summary>
                            <p className="border-t border-[#e3e9e8] p-3 text-sm leading-6 text-[#51616b]">{job.translated_instructions}</p>
                          </details>
                        )}
                        {job.status === "ready" && (
                          <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            {[
                              ["Reason for admission", "admission_reason"],
                              ["Final diagnoses", "final_diagnoses"],
                              ["Hospital course", "hospital_course"],
                              ["Condition at discharge", "condition_at_discharge"],
                              ["Follow-up", "follow_up"],
                              ["Discharge instructions", "discharge_instructions"],
                              ["Warning signs", "warning_signs"],
                            ].map(([label, key]) => (
                              <div key={key} className="rounded-lg bg-[#f7f9f9] p-4">
                                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wide text-[#0c716e]">{label}</h4>
                                {section(key).length ? (
                                  <ul className="space-y-2">
                                    {section(key).map((item) => (
                                      <li key={item} className="grid grid-cols-[16px_1fr] text-xs leading-5">
                                        <span className="text-[#0c716e]">•</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-[#9aa7ac]">Not documented</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!chart.discharge_summaries.length && <p className="text-sm text-[#9aa7ac]">No discharge summary generated yet.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "clinical" && <ClinicalSection id="emr-summary" title="Structured EMR Summary">
                {note ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[#e3e9e8] p-4 lg:col-span-2">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Chief complaint</h3>
                      <PointList value={note.chief_complaint} />
                    </div>
                    <div className="rounded-xl border border-[#e3e9e8] p-4">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Subjective</h3>
                      <PointList value={note.subjective} />
                    </div>
                    <div className="rounded-xl border border-[#e3e9e8] p-4">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Objective</h3>
                      <PointList value={note.objective} />
                    </div>
                    <div className="rounded-xl border border-[#e3e9e8] p-4">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Assessment</h3>
                      <PointList value={note.assessment} />
                    </div>
                    <div className="rounded-xl border border-[#e3e9e8] p-4">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Plan</h3>
                      <PointList value={note.plan} />
                    </div>
                    {note.symptoms.length > 0 && (
                      <div className="rounded-xl border border-[#e3e9e8] p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Symptoms</h3>
                        <PointList value={note.symptoms.join(". ")} />
                      </div>
                    )}
                    {note.diagnoses.length > 0 && (
                      <div className="rounded-xl border border-[#e3e9e8] p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">Diagnoses</h3>
                        <PointList value={note.diagnoses.join(". ")} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#9aa7ac]">No structured EMR is available yet.</p>
                )}
              </ClinicalSection>}

              <p className="px-5 py-4 text-[10px] text-[#9aa7ac] sm:px-7">
                Created: {latest ? new Date(latest.created_at).toLocaleString() : "—"} by {patient.doctor_name || workspace.current_user.full_name}
                {" · "}Last updated: {chart.records[0] ? new Date(chart.records[0].created_at).toLocaleString() : "—"}
              </p>
            </div>

            {/* Right column -------------------------------------------------- */}
            <div className="space-y-5">
              <div className="rounded-xl border border-[#dfe7e6] bg-white p-5 shadow-[0_6px_24px_rgba(35,58,55,.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Today&apos;s Orders ({orders.length})</h3>
                  <button type="button" onClick={() => setActiveTab("medications")} className="text-[10px] font-semibold text-[#0c716e]">
                    View all
                  </button>
                </div>
                <ul className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0c716e]" />
                        <span className="truncate font-medium text-[#18232f]">{order.name}</span>
                      </span>
                      <span className="shrink-0 text-[#9aa7ac]">{order.frequency}</span>
                    </li>
                  ))}
                </ul>
                {orders.length > 5 && <p className="mt-3 text-[10px] font-semibold text-[#0c716e]">+{orders.length - 5} more orders</p>}
                {!orders.length && <p className="text-xs text-[#9aa7ac]">No orders yet today.</p>}
              </div>

              <div className="rounded-xl border border-[#dfe7e6] bg-white p-5 shadow-[0_6px_24px_rgba(35,58,55,.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Medications</h3>
                  <button type="button" onClick={() => setActiveTab("medications")} className="text-[10px] font-semibold text-[#0c716e]">
                    View all
                  </button>
                </div>
                <MedicationDonut names={orders.map((order) => order.name)} />
              </div>

              <div className="rounded-xl border border-[#dfe7e6] bg-white p-5 shadow-[0_6px_24px_rgba(35,58,55,.05)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Recent Reports</h3>
                  <button type="button" onClick={() => setActiveTab("reports")} className="text-[10px] font-semibold text-[#0c716e]">
                    View all
                  </button>
                </div>
                <ul className="space-y-3">
                  {recentReports.map((report) => (
                    <li key={report.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon name="file" size={14} className="mt-0.5 shrink-0 text-[#9aa7ac]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#18232f]">{report.title}</p>
                          <p className="mt-0.5 text-[10px] text-[#9aa7ac]">{new Date(report.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2"><button onClick={() => openReport(report.id)} className="font-semibold text-[#0c716e] hover:underline">Open</button><ReportState status={report.status} /></div>
                    </li>
                  ))}
                </ul>
                {!recentReports.length && <p className="text-xs text-[#9aa7ac]">No reports uploaded.</p>}
              </div>
            </div>
          </div>
        </main>
      </div>

      {action === "report" && <ReportUploadModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "record" && <AddRecordModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "voice-encounter" && <VoiceEncounterModal patientId={patient.id} onClose={() => setAction(null)} onQueued={() => { setEncounterQueued(true); setActiveTab("timeline"); void load(); }} />}
      {action === "medication" && <AddMedicationModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "discharge" && <DischargeRecordingModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "edit-patient" && <EditPatientModal patient={patient} onClose={() => setAction(null)} onDone={() => void load()} />}
    </div>
  );
}
