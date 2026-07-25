"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Icon, IconName } from "@/components/Icon";
import { apiFetch, clearTokens, hasSession } from "@/lib/api";
import type {
  ClinicalInvitation,
  ClinicalRole,
  ClinicalUser,
  NetworkHospital,
  PatientChart,
  PatientDashboardRecord,
  ReportUpload,
  RecordDetail,
  VoiceIntakeResult,
  VoiceJob,
  VoiceJobUpload,
  Workspace,
} from "@/lib/types";

type Tab = "home" | "users" | "network" | "library" | "settings";

const NAV: { id: Tab; label: string; icon: IconName; permission?: string }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "users", label: "Users", icon: "users", permission: "users:manage" },
  { id: "network", label: "My Network", icon: "network", permission: "network:manage" },
  { id: "library", label: "EHR Library", icon: "library" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const inputClass =
  "focus-ring w-full h-10 rounded-lg border bg-[var(--ink)] px-3 text-sm placeholder:text-[var(--faint)] disabled:opacity-60";
const buttonPrimary =
  "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--teal)] px-4 text-sm font-semibold text-[#07110f] transition hover:brightness-110 disabled:opacity-60";
const buttonSecondary =
  "focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-[var(--ink-elevated)] px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border bg-[var(--ink-elevated)] shadow-2xl ${wide ? "max-w-4xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-[var(--ink-elevated)] px-6 py-5">
          <div>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--ink-panel)] hover:text-[var(--text)]" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "text-[var(--teal)] bg-[var(--teal-soft)]"
      : status === "registered"
        ? "text-[var(--teal)] bg-[var(--teal-soft)]"
        : status === "needs_attention"
          ? "text-[var(--danger)] bg-red-500/10"
      : status === "pending_review"
        ? "text-amber-500 bg-amber-500/10"
        : status === "registering_patient"
          ? "text-amber-500 bg-amber-500/10"
        : "text-[var(--muted)] bg-[var(--ink-panel)]";
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${color}`}>{status.replaceAll("_", " ")}</span>;
}

function RecordDetailModal({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<RecordDetail>(`/emr/records/${recordId}`).then(setRecord).catch((reason) => setError(reason.message));
  }, [recordId]);

  return (
    <Modal title="Electronic medical record" subtitle={record ? `Record ${record.id.slice(0, 8).toUpperCase()}` : "Loading record…"} onClose={onClose} wide>
      <div className="p-6">
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
        {!record && !error && <p className="py-16 text-center text-sm text-[var(--muted)]">Retrieving clinical record…</p>}
        {record && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={record.status} />
              <span className="font-mono text-xs text-[var(--faint)]">{record.source_language}</span>
            </div>
            {record.structured_note ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["Chief complaint", record.structured_note.chief_complaint],
                  ["Subjective", record.structured_note.subjective],
                  ["Objective", record.structured_note.objective],
                  ["Assessment", record.structured_note.assessment],
                  ["Plan", record.structured_note.plan],
                ].map(([label, value], index) => (
                  <section key={label} className={`rounded-xl border bg-[var(--ink)] p-4 ${index === 0 || index === 4 ? "md:col-span-2" : ""}`}>
                    <h3 className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--teal)]">{label}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{value || "Not documented"}</p>
                  </section>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border p-4 text-sm text-[var(--muted)]">Structured note is still being prepared.</p>
            )}
            {record.suggested_codes.length > 0 && (
              <section>
                <h3 className="font-display font-semibold">Clinical codes</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.suggested_codes.map((code) => (
                    <span key={`${code.system}-${code.code}`} className="rounded-lg border bg-[var(--ink)] px-3 py-2 text-xs">
                      <span className="font-mono text-[var(--teal)]">{code.code}</span> · {code.display_term}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {(record.translated_text || record.raw_transcript) && (
              <details className="rounded-xl border bg-[var(--ink)]">
                <summary className="cursor-pointer p-4 text-sm font-medium">Original transcription</summary>
                <p className="border-t p-4 text-sm leading-6 text-[var(--muted)]">{record.translated_text || record.raw_transcript}</p>
              </details>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function VoiceEncounterModal({ onClose, onQueued, patientId }: { onClose: () => void; onQueued: () => void; patientId?: string }) {
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [result, setResult] = useState<VoiceIntakeResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    mediaRecorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudio(null);
      chunks.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        setAudio(new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onerror = () => {
        setError("The browser could not continue recording. Restart the recording and try again.");
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setElapsed(0);
      timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      setRecording(true);
    } catch {
      setError("Microphone access is required to record the patient intake.");
    }
  }

  function stopRecording() {
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
  }

  async function restartRecording() {
    setAudio(null);
    setElapsed(0);
    setError("");
    await startRecording();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audio) {
      setError("Record the patient intake before creating the record.");
      return;
    }
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const contentType = (audio.type || "audio/webm").split(";", 1)[0].trim();

    try {
      setUploadStage("Preparing secure upload…");
      const job = await apiFetch<VoiceJobUpload>("/emr/voice-jobs", {
        method: "POST",
        body: JSON.stringify({
          content_type: contentType,
          file_size: audio.size,
          language_code: String(form.get("language_code") || "unknown"),
          department: form.get("department") || null,
          patient_id: patientId || null,
        }),
      });
      setUploadStage("Uploading recording…");
      const uploadResponse = await fetch(job.upload_url, {
        method: "PUT",
        headers: { "Content-Type": job.content_type },
        body: audio,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Audio upload failed (${uploadResponse.status}). Your recording is still saved.`);
      }
      setUploadStage(patientId ? "Starting encounter processing…" : "Starting patient registration…");
      await apiFetch<VoiceJob>(`/emr/voice-jobs/${job.job_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ etag: uploadResponse.headers.get("etag") }),
      });
      onQueued();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload the recording");
    } finally {
      setSubmitting(false);
      setUploadStage("");
    }
  }

  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <Modal
      title={patientId ? "Record new encounter" : "Voice patient intake"}
      subtitle={patientId ? "Record this encounter; the existing voice workers will transcribe it and add the structured note to this patient’s EMR." : "Create the patient and clinical record directly from your dictation."}
      onClose={onClose}
    >
      {result ? (
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal-soft)] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--teal)] text-[#07110f]">
                <Icon name="shield" size={17} />
              </span>
              <div>
                <p className="font-medium text-[var(--teal)]">Patient record ready</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {result.patient.created ? "A new patient was created" : "The existing patient was matched"} and the EMR is waiting for doctor review.
                </p>
              </div>
            </div>
          </div>
          <dl className="grid gap-3 rounded-xl border bg-[var(--ink)] p-4 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--faint)]">Patient</dt>
              <dd className="mt-1 text-sm font-medium">{result.patient.full_name}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--faint)]">Patient ID</dt>
              <dd className="mt-1 font-mono text-sm">{result.patient.patient_reference}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--faint)]">Age</dt>
              <dd className="mt-1 text-sm">{result.patient.age ?? "Not stated"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--faint)]">Status</dt>
              <dd className="mt-1"><StatusPill status={result.status} /></dd>
            </div>
          </dl>
          <details className="rounded-xl border bg-[var(--ink)]">
            <summary className="cursor-pointer p-4 text-sm font-medium">Review captured transcript</summary>
            <p className="border-t p-4 text-sm leading-6 text-[var(--muted)]">
              {result.translated_text || result.raw_transcript}
            </p>
          </details>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={buttonPrimary}>View on dashboard</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="p-6">
          {error && (
            <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">
              <p>{error}</p>
              {audio && <p className="mt-1 text-xs text-[var(--muted)]">Your recording is still saved. Retry it below or restart the recording.</p>}
            </div>
          )}
          <div className="rounded-xl border border-[var(--teal)]/25 bg-[var(--teal-soft)] p-4">
            <p className="text-sm font-medium text-[var(--teal)]">What to say</p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {patientId ? "Describe the current complaint, findings, assessment, treatment, medications, and follow-up plan." : "Begin with the patient's full name and age. Then say their patient ID, gender, phone number and clinical details when available."}
            </p>
            <p className="mt-2 font-mono text-[11px] leading-5 text-[var(--faint)]">
              “Patient Ananya Rao, age 34, patient ID MRN 4821. She reports…”
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs text-[var(--muted)]">Department</span>
              <input name="department" className={inputClass} placeholder="Optional override" />
            </label>
            <label>
              <span className="mb-2 block text-xs text-[var(--muted)]">Dictation language</span>
              <select name="language_code" className={inputClass}>
                <option value="unknown">Detect automatically</option>
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi</option>
                <option value="kn-IN">Kannada</option>
                <option value="te-IN">Telugu</option>
                <option value="ta-IN">Tamil</option>
                <option value="ml-IN">Malayalam</option>
                <option value="mr-IN">Marathi</option>
                <option value="bn-IN">Bengali</option>
              </select>
            </label>
          </div>
          <div className="mt-6 rounded-2xl border bg-[var(--ink)] p-6 text-center">
            <p className="font-mono text-xs text-[var(--faint)]">{recording ? time : audio ? "Recording ready" : "Ready to record"}</p>
            <div className="relative mx-auto mt-4 grid h-20 w-20 place-items-center">
              {recording && <span className="absolute inset-0 rounded-full border border-[var(--teal)] animate-[pulse-ring_1.4s_ease-out_infinite]" />}
              <button
                type="button"
                onClick={recording ? stopRecording : audio ? restartRecording : startRecording}
                disabled={submitting}
                className={`focus-ring relative grid h-16 w-16 place-items-center rounded-full ${recording ? "bg-[var(--danger)] text-white" : "bg-[var(--teal)] text-[#07110f]"}`}
                aria-label={recording ? "Stop recording" : audio ? "Restart recording" : "Start recording"}
              >
                {recording ? <span className="h-5 w-5 rounded-sm bg-white" /> : <Icon name="mic" size={25} />}
              </button>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              {recording ? "Listening… stop when the patient details and clinical notes are complete." : audio ? "Recording saved and ready to process." : "Start recording, then speak the patient details and clinical notes."}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className={buttonSecondary}>Cancel</button>
            {recording ? (
              <button type="button" onClick={stopRecording} className={buttonPrimary}>
                <span className="h-3 w-3 rounded-sm bg-current" /> Stop recording
              </button>
            ) : audio ? (
              <>
                <button type="button" onClick={restartRecording} disabled={submitting} className={buttonSecondary}>
                  <Icon name="refresh" size={15} /> Restart recording
                </button>
                <button disabled={submitting} className={buttonPrimary}>
                  <Icon name="activity" size={16} />
                  {submitting ? uploadStage || "Uploading…" : error ? "Retry upload" : patientId ? "Upload & process encounter" : "Upload & register patient"}
                </button>
              </>
            ) : (
              <button type="button" onClick={startRecording} className={buttonPrimary}>
                <Icon name="mic" size={16} /> Start recording
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ReportUploadModal({
  patientId,
  onClose,
  onDone,
}: {
  patientId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [captureSource, setCaptureSource] = useState<"file" | "camera">("file");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a report file or take a clear photo first.");
      return;
    }
    const title = String(new FormData(event.currentTarget).get("title") || "").trim();
    setSubmitting(true);
    setError("");
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      const contentType = (
        file.type ||
        (extension === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : extension === "doc"
            ? "application/msword"
            : "application/octet-stream")
      ).split(";", 1)[0];
      setStage("Preparing secure upload…");
      const upload = await apiFetch<ReportUpload>(`/patients/${patientId}/reports`, {
        method: "POST",
        body: JSON.stringify({
          title,
          content_type: contentType,
          file_size: file.size,
          capture_source: captureSource,
        }),
      });
      setStage("Uploading report…");
      const response = await fetch(upload.upload_url, {
        method: "PUT",
        headers: { "Content-Type": upload.content_type },
        body: file,
      });
      if (!response.ok) throw new Error(`Report upload failed (${response.status}).`);
      setStage("Starting report review…");
      await apiFetch(`/patients/${patientId}/reports/${upload.report_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ etag: response.headers.get("etag") }),
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload this report.");
    } finally {
      setSubmitting(false);
      setStage("");
    }
  }

  function choose(nextFile: File | undefined, source: "file" | "camera") {
    if (!nextFile) return;
    setFile(nextFile);
    setCaptureSource(source);
    setError("");
  }

  return (
    <Modal title="Upload clinical report" subtitle="Add a PDF or a clear photo of a report. Multiple reports can be added to this chart." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-6">
        <label className="block text-xs text-[var(--muted)]">
          Report name
          <input name="title" required minLength={2} className={`${inputClass} mt-2`} placeholder="e.g. CT chest report — 25 Jul 2026" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="focus-ring flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-[var(--ink)] p-5 text-sm hover:border-[var(--teal)]">
            <Icon name="upload" /> Upload file
            <input type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => choose(event.target.files?.[0], "file")} />
          </label>
          <label className="focus-ring flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-[var(--ink)] p-5 text-sm hover:border-[var(--teal)]">
            <Icon name="camera" /> Take picture
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => choose(event.target.files?.[0], "camera")} />
          </label>
        </div>
        {file && (
          <div className="rounded-lg border bg-[var(--ink)] p-3 text-xs">
            <p className="font-medium">{file.name}</p>
            <p className="mt-1 text-[var(--faint)]">{(file.size / 1024 / 1024).toFixed(2)} MB · {captureSource === "camera" ? "Camera photo" : "Uploaded file"}</p>
          </div>
        )}
        <p className="rounded-lg bg-amber-500/10 p-3 text-xs leading-5 text-amber-600">
          PDF and Word documents are supported. For photos, use a flat, well-lit image with all four corners visible. If text cannot be read reliably, the chart will ask you to take the picture again. AI summarizes report text only; it does not diagnose CT/MRI/X-ray imagery.
        </p>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonSecondary}>Cancel</button>
          <button disabled={submitting || !file} className={buttonPrimary}><Icon name="upload" size={15} /> {submitting ? stage : "Upload report"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function AddMedicationModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim() || null;
    try {
      await apiFetch(`/patients/${patientId}/medications`, {
        method: "POST",
        body: JSON.stringify({
          name: value("name"),
          dosage: value("dosage"),
          frequency: value("frequency"),
          route: value("route"),
          duration: value("duration"),
          instructions: value("instructions"),
        }),
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add medication.");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal title="Add medication" subtitle="Add an order to the patient's longitudinal medication list." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Medication name<input name="name" required className={`${inputClass} mt-2`} placeholder="Medicine or generic name" /></label>
        <label className="text-xs text-[var(--muted)]">Dosage<input name="dosage" className={`${inputClass} mt-2`} placeholder="e.g. 500 mg" /></label>
        <label className="text-xs text-[var(--muted)]">Frequency<input name="frequency" className={`${inputClass} mt-2`} placeholder="e.g. Twice daily" /></label>
        <label className="text-xs text-[var(--muted)]">Route<input name="route" className={`${inputClass} mt-2`} placeholder="Oral / IV / topical" /></label>
        <label className="text-xs text-[var(--muted)]">Duration<input name="duration" className={`${inputClass} mt-2`} placeholder="e.g. 5 days" /></label>
        <label className="text-xs text-[var(--muted)] sm:col-span-2">Instructions<textarea name="instructions" rows={3} className="focus-ring mt-2 w-full rounded-lg border bg-[var(--ink)] p-3 text-sm" placeholder="Clinical instructions" /></label>
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-xs text-[var(--danger)] sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className={buttonSecondary}>Cancel</button><button disabled={submitting} className={buttonPrimary}><Icon name="pill" size={15} /> {submitting ? "Adding…" : "Add medication"}</button></div>
      </form>
    </Modal>
  );
}

export function AddRecordModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || "").trim();
    try {
      await apiFetch(`/patients/${patientId}/records`, {
        method: "POST",
        body: JSON.stringify({
          title: text("title"),
          department: text("department") || null,
          subjective: text("subjective"),
          objective: text("objective"),
          assessment: text("assessment"),
          plan: text("plan"),
        }),
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add the clinical record.");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal title="Add clinical record" subtitle="Create another visit/note under this patient." onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4 p-6 md:grid-cols-2">
        <label className="text-xs text-[var(--muted)]">Record title<input name="title" required className={`${inputClass} mt-2`} placeholder="Chief complaint / visit purpose" /></label>
        <label className="text-xs text-[var(--muted)]">Department<input name="department" className={`${inputClass} mt-2`} placeholder="e.g. General Medicine" /></label>
        {["subjective", "objective", "assessment", "plan"].map((field) => (
          <label key={field} className="text-xs capitalize text-[var(--muted)]">{field}<textarea name={field} rows={4} className="focus-ring mt-2 w-full rounded-lg border bg-[var(--ink)] p-3 text-sm" /></label>
        ))}
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-xs text-[var(--danger)] md:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 md:col-span-2"><button type="button" onClick={onClose} className={buttonSecondary}>Cancel</button><button disabled={submitting} className={buttonPrimary}><Icon name="plus" size={15} /> {submitting ? "Creating…" : "Create record"}</button></div>
      </form>
    </Modal>
  );
}

export function PatientChartPanel({
  patient,
  openRecord,
  refreshDashboard,
}: {
  patient: PatientDashboardRecord;
  openRecord: (id: string) => void;
  refreshDashboard: () => void;
}) {
  const [chart, setChart] = useState<PatientChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [action, setAction] = useState<"report" | "record" | "medication" | null>(null);

  const reload = useCallback(async () => {
    try {
      setError("");
      setChart(await apiFetch<PatientChart>(`/patients/${patient.id}/chart`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load patient chart.");
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(handle);
  }, [reload]);

  useEffect(() => {
    if (!chart?.reports.some((report) => ["queued", "processing"].includes(report.status))) return;
    const handle = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(handle);
  }, [chart?.reports, reload]);

  async function listen(recordId: string) {
    setAudioLoading(true);
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/records/${recordId}/audio`);
      setAudioUrl(access.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open the recording.");
    } finally {
      setAudioLoading(false);
    }
  }

  const latest = chart?.records[0];
  const done = () => {
    void reload();
    refreshDashboard();
  };

  return (
    <div className="space-y-5 py-1">
      <div className="flex flex-col gap-4 rounded-xl border bg-[var(--ink-elevated)] p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="font-mono text-[10px] uppercase text-[var(--faint)]">Patient</p><p className="mt-1 font-medium">{patient.patient_name}</p><p className="text-xs text-[var(--muted)]">{patient.patient_reference}</p></div>
          <div><p className="font-mono text-[10px] uppercase text-[var(--faint)]">Demographics</p><p className="mt-1 text-sm">{patient.age ?? "—"} years · {patient.gender || "Not recorded"}</p><p className="text-xs text-[var(--muted)]">{patient.phone || "No phone"}</p></div>
          <div><p className="font-mono text-[10px] uppercase text-[var(--faint)]">Care provider</p><p className="mt-1 text-sm">{patient.doctor_name || "No consultation yet"}</p><p className="text-xs text-[var(--muted)]">{patient.nurses.join(", ") || "No nurse recorded"}</p></div>
          <div><p className="font-mono text-[10px] uppercase text-[var(--faint)]">Last visit</p><p className="mt-1 text-sm">{patient.last_visit_at ? new Date(patient.last_visit_at).toLocaleString() : "No visit"}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {latest?.audio_available && <button onClick={() => listen(latest.id)} disabled={audioLoading} className={buttonSecondary}><Icon name="play" size={14} /> {audioLoading ? "Getting audio…" : "Listen recording"}</button>}
          <button onClick={() => setAction("report")} className={buttonSecondary}><Icon name="upload" size={14} /> Upload reports</button>
          <button onClick={() => setAction("record")} className={buttonSecondary}><Icon name="plus" size={14} /> Add record</button>
          <button onClick={() => setAction("medication")} className={buttonSecondary}><Icon name="pill" size={14} /> Add medication</button>
        </div>
      </div>

      {audioUrl && <div className="rounded-xl border bg-[var(--ink-elevated)] p-4"><p className="mb-3 font-mono text-[10px] uppercase text-[var(--teal)]">Original consultation recording · temporary private link</p><audio controls autoPlay src={audioUrl} className="w-full" /></div>}
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-[var(--danger)]">{error}</p>}
      {loading && <p className="py-8 text-center text-sm text-[var(--muted)]">Loading complete patient chart…</p>}

      {chart && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <section className="rounded-xl border bg-[var(--ink-elevated)]">
              <div className="flex items-center justify-between border-b p-4"><div><h3 className="font-display font-semibold">Clinical records</h3><p className="mt-1 text-xs text-[var(--muted)]">Longitudinal visits and structured EMR notes</p></div><span className="font-mono text-xs text-[var(--faint)]">{chart.records.length} records</span></div>
              <div className="divide-y">
                {chart.records.map((clinicalRecord) => {
                  const note = clinicalRecord.structured_note;
                  return (
                    <article key={clinicalRecord.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="font-medium">{note?.chief_complaint || "Clinical consultation"}</p><p className="mt-1 text-xs text-[var(--faint)]">{new Date(clinicalRecord.created_at).toLocaleString()} · {clinicalRecord.source_language}</p></div>
                        <div className="flex gap-2"><StatusPill status={clinicalRecord.status} />{clinicalRecord.audio_available && <button onClick={() => listen(clinicalRecord.id)} className="focus-ring rounded-md border p-1.5 text-[var(--teal)]" aria-label="Listen to this visit"><Icon name="play" size={14} /></button>}<button onClick={() => openRecord(clinicalRecord.id)} className="focus-ring rounded-md border px-2 py-1 text-xs">Full EMR</button></div>
                      </div>
                      {note && <div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Subjective", note.subjective], ["Objective", note.objective], ["Assessment", note.assessment], ["Plan", note.plan]].map(([label, value]) => <div key={label} className="rounded-lg bg-[var(--ink)] p-3"><p className="font-mono text-[9px] uppercase tracking-wide text-[var(--teal)]">{label}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--muted)]">{value || "Not documented"}</p></div>)}</div>}
                    </article>
                  );
                })}
                {!chart.records.length && <p className="p-6 text-sm text-[var(--muted)]">No clinical records yet.</p>}
              </div>
            </section>

            <section className="rounded-xl border bg-[var(--ink-elevated)]">
              <div className="flex items-center justify-between border-b p-4"><div><h3 className="font-display font-semibold">Reports & investigations</h3><p className="mt-1 text-xs text-[var(--muted)]">AI-assisted document summaries for clinician review</p></div><button onClick={() => setAction("report")} className={buttonSecondary}><Icon name="upload" size={13} /> Upload</button></div>
              <div className="divide-y">
                {chart.reports.map((report) => (
                  <article key={report.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{report.title}</p><p className="mt-1 text-xs text-[var(--faint)]">{report.document_type || "Clinical document"} · {new Date(report.created_at).toLocaleString()}</p></div><StatusPill status={report.status} /></div>
                    {["queued", "processing"].includes(report.status) && <p className="mt-3 text-xs text-[var(--muted)]">Extracting report details in the background…</p>}
                    {report.status === "needs_reupload" && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-xs font-semibold text-amber-600">Photo is not clear enough. Please click the picture again.</p><p className="mt-1 text-xs text-amber-600/80">{report.quality_message}</p><button onClick={() => setAction("report")} className="mt-3 rounded-md border border-amber-500/40 px-3 py-1.5 text-xs text-amber-700">Take a clearer picture</button></div>}
                    {report.status === "failed" && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-[var(--danger)]">{report.quality_message || "Report processing failed."}</p>}
                    {report.summary && <div className="mt-3"><p className="text-sm leading-6 text-[var(--muted)]">{report.summary}</p>{report.key_findings.length > 0 && <ul className="mt-3 space-y-1">{report.key_findings.map((finding) => <li key={finding} className="flex gap-2 text-xs"><span className="text-[var(--teal)]">•</span>{finding}</li>)}</ul>}</div>}
                  </article>
                ))}
                {!chart.reports.length && <p className="p-6 text-sm text-[var(--muted)]">No reports uploaded.</p>}
              </div>
            </section>
          </div>

          <section className="self-start rounded-xl border bg-[var(--ink-elevated)]">
            <div className="flex items-center justify-between border-b p-4"><div><h3 className="font-display font-semibold">Medication orders</h3><p className="mt-1 text-xs text-[var(--muted)]">Current longitudinal list</p></div><button onClick={() => setAction("medication")} className={buttonSecondary}><Icon name="plus" size={13} /> Add</button></div>
            <div className="divide-y">
              {chart.medications.map((medication, index) => <div key={medication.id} className="grid grid-cols-[28px_1fr] gap-2 p-4"><span className="font-mono text-xs text-[var(--faint)]">{index + 1}</span><div><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{medication.name}</p><span className="rounded-full bg-[var(--teal-soft)] px-2 py-0.5 text-[9px] uppercase text-[var(--teal)]">{medication.is_active ? "Active" : "Stopped"}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{[medication.dosage, medication.route, medication.frequency, medication.duration].filter(Boolean).join(" · ") || "Instructions not recorded"}</p>{medication.instructions && <p className="mt-2 text-xs leading-5 text-[var(--faint)]">{medication.instructions}</p>}</div></div>)}
              {!chart.medications.length && <p className="p-6 text-sm text-[var(--muted)]">No medication orders added.</p>}
            </div>
          </section>
        </div>
      )}

      {action === "report" && <ReportUploadModal patientId={patient.id} onClose={() => setAction(null)} onDone={done} />}
      {action === "record" && <AddRecordModal patientId={patient.id} onClose={() => setAction(null)} onDone={done} />}
      {action === "medication" && <AddMedicationModal patientId={patient.id} onClose={() => setAction(null)} onDone={done} />}
    </div>
  );
}

function Dashboard({
  workspace,
  records,
  voiceJobs,
  loading,
  error,
  refresh,
}: {
  workspace: Workspace;
  records: PatientDashboardRecord[];
  voiceJobs: VoiceJob[];
  loading: boolean;
  error: string;
  refresh: () => void;
}) {
  const router = useRouter();
  const [recordModal, setRecordModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const approved = records.filter((record) => record.status === "approved").length;
  const pending = records.filter((record) => record.status === "pending_review").length;
  const jobsByPatient = new Map(
    voiceJobs.filter((job) => job.patient_id).map((job) => [job.patient_id, job]),
  );
  const registeredPatients = records.map((record) => {
    const job = jobsByPatient.get(record.id);
    if (!job) return record;
    return {
      ...record,
      status: job.status === "failed" ? "needs_attention" : "registered",
    };
  });
  const provisionalPatients: PatientDashboardRecord[] = voiceJobs
    .filter((job) => !job.patient_id)
    .map((job, index) => ({
      id: `job-${job.id}`,
      latest_record_id: null,
      encounter_id: null,
      encounter_number: null,
      ward_number: null,
      bed_number: null,
      patient_name: job.status === "failed" ? "Voice intake needs attention" : "Registering patient",
      patient_reference: "—",
      serial_number: index + 1,
      age: null,
      gender: null,
      phone: null,
      subject: job.error_message || "Patient details are being prepared from the recording.",
      doctor_name: workspace.current_user.full_name,
      nurses: [],
      status: job.status === "failed" ? "needs_attention" : "registering_patient",
      created_at: job.created_at,
      last_visit_at: null,
    }));
  const displayedRecords = [...provisionalPatients, ...registeredPatients].map(
    (record, index) => ({ ...record, serial_number: index + 1 }),
  );

  return (
    <>
      <header className="flex flex-col gap-4 border-b px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--teal)]">Clinical overview</p>
          <h1 className="font-display mt-1 text-2xl font-semibold">Good day, {workspace.current_user.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here is what is happening across {workspace.organization.name}.</p>
        </div>
        <button onClick={() => setRecordModal(true)} className={buttonPrimary}>
          <Icon name="mic" size={17} /> Voice Patient Intake
        </button>
      </header>
      <main className="space-y-6 p-5 md:p-8">
        {notice && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--teal)]/30 bg-[var(--teal-soft)] p-3 text-sm text-[var(--teal)]">
            <span>Recording uploaded successfully. Patient registration has started.</span>
            <button onClick={() => setNotice("")} className="focus-ring rounded p-1" aria-label="Dismiss message"><Icon name="close" size={14} /></button>
          </div>
        )}
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Total patients", records.length, "users", "Everyone in the patient registry"],
            ["Pending review", pending, "activity", "Needs doctor attention"],
            ["Approved", approved, "shield", "Clinically verified"],
          ].map(([label, value, icon, note]) => (
            <div key={String(label)} className="rounded-xl border bg-[var(--ink-elevated)] p-5 shadow-[0_8px_30px_var(--shadow)]">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">{label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name={icon as IconName} size={16} /></span>
              </div>
              <p className="font-display mt-4 text-3xl">{value}</p>
              <p className="mt-1 text-xs text-[var(--faint)]">{note}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border bg-[var(--ink-elevated)] shadow-[0_8px_30px_var(--shadow)]">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display font-semibold">Patient records</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Every registered patient, with their latest EMR when available.</p>
            </div>
            <button onClick={refresh} className={buttonSecondary}><Icon name="refresh" size={14} /> Refresh</button>
          </div>
          {error && <p className="m-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="border-b bg-[var(--ink)] font-mono text-[10px] uppercase tracking-[.1em] text-[var(--faint)]">
                  <th className="w-12 px-4 py-3" />
                  <th className="px-3 py-3">S/N</th>
                  <th className="px-3 py-3">Patient name</th>
                  <th className="px-3 py-3">Patient ID</th>
                  <th className="px-3 py-3">Age</th>
                  <th className="px-3 py-3">Subject line of EMR</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-10 text-center text-sm text-[var(--muted)]">Loading patient records…</td></tr>
                ) : displayedRecords.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-center"><Icon name="file" size={28} className="mx-auto text-[var(--faint)]" /><p className="mt-3 text-sm">No patients yet</p><p className="mt-1 text-xs text-[var(--muted)]">Create your first patient using voice intake.</p></td></tr>
                ) : displayedRecords.map((record) => (
                  <Fragment key={record.id}>
                    <tr className="border-b text-sm hover:bg-[var(--ink-panel)]">
                      <td className="px-4 py-4">
                        {!record.id.startsWith("job-") ? (
                          <button onClick={() => router.push(`${workspace.workspace_path}/patient/${record.id}`)} className="focus-ring rounded-md p-1 text-[var(--muted)] hover:text-[var(--teal)]" aria-label={`Open ${record.patient_name} patient page`}>
                            <Icon name="chevron" size={15} />
                          </button>
                        ) : record.id.startsWith("job-") ? (
                          <Icon name="activity" size={15} className="text-amber-500" />
                        ) : null}
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-[var(--faint)]">{String(record.serial_number).padStart(2, "0")}</td>
                      <td className="px-3 py-4 font-medium">{record.patient_name}</td>
                      <td className="px-3 py-4 font-mono text-xs text-[var(--muted)]">{record.patient_reference}</td>
                      <td className="px-3 py-4">{record.age ?? "—"}</td>
                      <td className="max-w-xs truncate px-3 py-4 text-[var(--muted)]">{record.subject}</td>
                      <td className="px-3 py-4"><StatusPill status={record.status} /></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {recordModal && (
        <VoiceEncounterModal
          onClose={() => setRecordModal(false)}
          onQueued={() => {
            setNotice("uploaded");
            refresh();
          }}
        />
      )}
      {detailId && <RecordDetailModal recordId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function SettingsPage({ workspace }: { workspace: Workspace }) {
  const organization = workspace.organization;
  const rows = [
    ["Client name", organization.name],
    ["Client code", organization.code],
    ["Client email", organization.email],
    ["GST number", organization.gst_number || "Not provided"],
    ["Contact person", organization.contact_name],
    ["Contact email", organization.contact_email],
    ["Contact mobile", organization.contact_mobile || "Not provided"],
    ["Headquarters", organization.hq_location || "Not provided"],
  ];
  return (
    <>
      <PageHeader eyebrow="Organisation settings" title="Workspace details" subtitle="This information is controlled by the HealthAI platform administrator and cannot be edited here." />
      <main className="p-5 md:p-8">
        <div className="max-w-4xl overflow-hidden rounded-xl border bg-[var(--ink-elevated)]">
          <div className="flex items-center gap-3 border-b p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="building" /></span>
            <div><h2 className="font-display font-semibold">{organization.name}</h2><p className="font-mono text-xs text-[var(--faint)]">{organization.code}</p></div>
          </div>
          <div className="grid md:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="border-b p-5 md:border-r">
                <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--faint)]">{label}</p>
                <p className="mt-2 text-sm">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b px-5 py-6 md:flex-row md:items-center md:justify-between md:px-8">
      <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--teal)]">{eyebrow}</p><h1 className="font-display mt-1 text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p></div>
      {action}
    </header>
  );
}

function UsersPage() {
  const [users, setUsers] = useState<ClinicalUser[]>([]);
  const [roles, setRoles] = useState<ClinicalRole[]>([]);
  const [invitations, setInvitations] = useState<ClinicalInvitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    setError("");
    Promise.all([
      apiFetch<ClinicalUser[]>("/doctor/users"),
      apiFetch<ClinicalRole[]>("/doctor/roles"),
      apiFetch<ClinicalInvitation[]>("/doctor/invitations"),
    ]).then(([userRows, roleRows, inviteRows]) => {
      setUsers(userRows); setRoles(roleRows); setInvitations(inviteRows);
    }).catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    // Load the current server-backed member and invitation state on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/doctor/invitations", { method: "POST", body: JSON.stringify({ full_name: form.get("full_name"), email: form.get("email"), role_id: form.get("role_id") }) });
      setMessage("Invitation sent successfully.");
      setShowInvite(false);
      load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to send invitation"); }
  }

  async function updateUser(user: ClinicalUser, roleId: string, active = user.is_active) {
    try {
      await apiFetch(`/doctor/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role_id: roleId, is_active: active }) });
      setMessage("User permissions updated.");
      load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update user"); }
  }

  async function removeUser(user: ClinicalUser) {
    if (!window.confirm(`Remove ${user.full_name} from this workspace?`)) return;
    try {
      await apiFetch(`/doctor/users/${user.id}`, { method: "DELETE" });
      setMessage("User removed from the workspace.");
      load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove user"); }
  }

  async function resend(invitation: ClinicalInvitation) {
    try {
      await apiFetch(`/doctor/invitations/${invitation.id}/resend`, { method: "POST" });
      setMessage(`Invitation resent to ${invitation.email}.`);
      load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to resend invitation"); }
  }

  return (
    <>
      <PageHeader eyebrow="Access control" title="Users" subtitle="Invite clinicians and control what each person can do." action={<button onClick={() => setShowInvite(true)} className={buttonPrimary}><Icon name="plus" size={16} /> Add person</button>} />
      <main className="space-y-6 p-5 md:p-8">
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="rounded-lg border border-[var(--teal)]/30 bg-[var(--teal-soft)] p-3 text-sm text-[var(--teal)]">{message}</p>}
        <section className="overflow-hidden rounded-xl border bg-[var(--ink-elevated)]">
          <div className="border-b p-5"><h2 className="font-display font-semibold">Workspace members</h2></div>
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="grid gap-4 p-5 md:grid-cols-[1fr_220px_auto] md:items-center">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--teal-soft)] text-xs font-semibold text-[var(--teal)]">{user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                  <div><p className="text-sm font-medium">{user.full_name} {user.is_current_user && <span className="text-[10px] text-[var(--teal)]">(YOU)</span>}</p><p className="text-xs text-[var(--muted)]">{user.email}</p></div>
                </div>
                <select value={user.role_id} disabled={user.is_current_user} onChange={(event) => updateUser(user, event.target.value)} className={inputClass}>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")}</option>)}
                </select>
                <div className="flex gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] ${user.is_active ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-red-500/10 text-[var(--danger)]"}`}>{user.is_active ? "ACTIVE" : "INACTIVE"}</span>
                  {!user.is_current_user && <button onClick={() => removeUser(user)} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-red-500/10 hover:text-[var(--danger)]" aria-label="Delete user"><Icon name="trash" size={16} /></button>}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-xl border bg-[var(--ink-elevated)]">
          <div className="border-b p-5"><h2 className="font-display font-semibold">Pending invitations</h2><p className="mt-1 text-xs text-[var(--muted)]">People who have not joined yet.</p></div>
          {invitations.length === 0 ? <p className="p-6 text-sm text-[var(--muted)]">No pending invitations.</p> : (
            <div className="divide-y">{invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium">{invitation.full_name}</p><p className="text-xs text-[var(--muted)]">{invitation.email} · {invitation.role.replaceAll("_", " ")}</p></div>
                <button onClick={() => resend(invitation)} className={buttonSecondary}><Icon name="refresh" size={14} /> Resend invite</button>
              </div>
            ))}</div>
          )}
        </section>
      </main>
      {showInvite && (
        <Modal title="Invite a user" subtitle="They will receive a secure email link to join this workspace." onClose={() => setShowInvite(false)}>
          <form onSubmit={invite} className="space-y-4 p-6">
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Full name *</span><input name="full_name" required className={inputClass} /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Email *</span><input name="email" type="email" required className={inputClass} /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Permission role *</span><select name="role_id" required className={inputClass}><option value="">Select a role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name.replaceAll("_", " ")} · {role.permissions.length} permissions</option>)}</select></label>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowInvite(false)} className={buttonSecondary}>Cancel</button><button className={buttonPrimary}><Icon name="mail" size={15} /> Send invitation</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

function NetworkPage() {
  const [hospitals, setHospitals] = useState<NetworkHospital[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => apiFetch<NetworkHospital[]>("/doctor/network").then(setHospitals).catch((reason) => setError(reason.message)), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/doctor/network", { method: "POST", body: JSON.stringify({ name: form.get("name"), place: form.get("place"), email: form.get("email"), contact_name: form.get("contact_name"), contact_email: form.get("contact_email") }) });
      setShowAdd(false); load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add hospital"); }
  }

  return (
    <>
      <PageHeader eyebrow="Hospital chain" title="My Network" subtitle="Create and manage hospital workspaces under your organisation." action={<button onClick={() => setShowAdd(true)} className={buttonPrimary}><Icon name="plus" size={16} /> Add hospital</button>} />
      <main className="p-5 md:p-8">
        {error && <p className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
        {hospitals.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-[var(--ink-elevated)] p-12 text-center"><Icon name="network" size={32} className="mx-auto text-[var(--teal)]" /><h2 className="font-display mt-4 text-xl">Build your hospital network</h2><p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">Add branches and locations. Each one gets its own secure workspace and owner invitations.</p><button onClick={() => setShowAdd(true)} className={`${buttonPrimary} mt-6`}><Icon name="plus" size={16} /> Add first hospital</button></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{hospitals.map((hospital) => (
            <article key={hospital.id} className="rounded-xl border bg-[var(--ink-elevated)] p-5">
              <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="building" /></span><span className="rounded-full bg-[var(--teal-soft)] px-2 py-1 text-[10px] text-[var(--teal)]">ACTIVE</span></div>
              <h2 className="font-display mt-4 text-lg font-semibold">{hospital.name}</h2>
              <p className="font-mono mt-1 text-xs text-[var(--teal)]">{hospital.code}</p>
              <dl className="mt-5 space-y-3 text-xs"><div><dt className="text-[var(--faint)]">Place</dt><dd className="mt-1 text-[var(--muted)]">{hospital.place}</dd></div><div><dt className="text-[var(--faint)]">Contact</dt><dd className="mt-1 text-[var(--muted)]">{hospital.contact_name} · {hospital.contact_email}</dd></div></dl>
            </article>
          ))}</div>
        )}
      </main>
      {showAdd && (
        <Modal title="Add hospital" subtitle="A separate workspace and owner access will be created automatically." onClose={() => setShowAdd(false)}>
          <form onSubmit={create} className="grid gap-4 p-6 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-2 block text-xs text-[var(--muted)]">Hospital name *</span><input name="name" required className={inputClass} placeholder="Rainbow – Banjara Hills" /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Place *</span><input name="place" required className={inputClass} placeholder="Hyderabad" /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Hospital email *</span><input name="email" type="email" required className={inputClass} /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Contact person *</span><input name="contact_name" required className={inputClass} /></label>
            <label><span className="mb-2 block text-xs text-[var(--muted)]">Contact email *</span><input name="contact_email" type="email" required className={inputClass} /></label>
            <p className="sm:col-span-2 rounded-lg bg-[var(--teal-soft)] p-3 text-xs text-[var(--teal)]">The workspace ID is generated from the main hospital chain and this branch name, with six-character code segments.</p>
            <div className="sm:col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setShowAdd(false)} className={buttonSecondary}>Cancel</button><button className={buttonPrimary}><Icon name="building" size={15} /> Create workspace</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

function LibraryPage() {
  return (
    <>
      <PageHeader eyebrow="Clinical resources" title="EHR Library" subtitle="A central home for record templates, coding references and clinical resources." />
      <main className="p-5 md:p-8">
        <div className="rounded-xl border border-dashed bg-[var(--ink-elevated)] p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="library" size={27} /></span>
          <h2 className="font-display mt-5 text-xl">EHR Library is ready for its next chapter</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">The page and navigation are in place. Templates, protocols and reusable clinical content can be added when the workflow is defined.</p>
        </div>
      </main>
    </>
  );
}

export function PortalApp({ clientName, workspaceId }: { clientName: string; workspaceId: string }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [records, setRecords] = useState<PatientDashboardRecord[]>([]);
  const [voiceJobs, setVoiceJobs] = useState<VoiceJob[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loadingError, setLoadingError] = useState("");

  const loadRecords = useCallback((silent = false) => {
    if (!silent) setRecordsLoading(true);
    setRecordsError("");
    Promise.allSettled([
      apiFetch<PatientDashboardRecord[]>("/doctor/patients"),
      apiFetch<VoiceJob[]>("/emr/voice-jobs"),
    ])
      .then(([patientsResult, jobsResult]) => {
        if (patientsResult.status === "fulfilled") {
          setRecords(patientsResult.value);
        } else {
          setRecordsError(patientsResult.reason instanceof Error ? patientsResult.reason.message : "Unable to load patients");
        }
        if (jobsResult.status === "fulfilled") {
          setVoiceJobs(jobsResult.value);
        }
      })
      .finally(() => setRecordsLoading(false));
  }, []);

  useEffect(() => {
    if (!hasSession()) { router.replace("/login"); return; }
    apiFetch<Workspace>("/doctor/workspace")
      .then((value) => {
        setWorkspace(value);
        if (value.workspace_slug !== clientName || value.encrypted_client_id !== workspaceId) {
          router.replace(value.workspace_path);
        }
      })
      .catch((reason) => {
        setLoadingError(reason.message);
        clearTokens();
        setTimeout(() => router.replace("/login"), 1000);
      });
    // Fetch tenant records after the authenticated shell mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecords();
  }, [clientName, loadRecords, router, workspaceId]);

  useEffect(() => {
    if (voiceJobs.length === 0) return;
    const poller = setInterval(() => loadRecords(true), 3000);
    return () => clearInterval(poller);
  }, [loadRecords, voiceJobs.length]);

  const visibleNav = useMemo(
    () => NAV.filter((item) => !item.permission || workspace?.current_user.permissions.includes(item.permission)),
    [workspace],
  );

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  if (!workspace) {
    return <div className="grid min-h-screen place-items-center bg-[var(--ink)]"><div className="text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--teal)] font-bold text-[#07110f]">+</span><p className="font-mono mt-4 text-xs text-[var(--muted)]">{loadingError || "Opening clinical workspace…"}</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--text)]">
      {mobileOpen && <button className="fixed inset-0 z-30 bg-black/55 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-[var(--ink-elevated)] transition-all duration-200 ${collapsed ? "w-[72px]" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-16 items-center border-b px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--teal)] font-bold text-[#07110f]">+</span>
          {!collapsed && <div className="min-w-0"><p className="truncate font-display text-sm font-semibold">Meridian Health AI</p><p className="truncate font-mono text-[9px] uppercase tracking-[.12em] text-[var(--faint)]">Doctor portal</p></div>}
        </div>
        <div className={`border-b p-4 ${collapsed ? "px-3" : ""}`}>
          <div className={`rounded-lg bg-[var(--ink)] p-3 ${collapsed ? "grid place-items-center p-2" : ""}`}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="building" size={16} /></span>
            {!collapsed && <><p className="mt-2 truncate text-xs font-medium">{workspace.organization.name}</p><p className="mt-1 truncate font-mono text-[9px] text-[var(--faint)]">{workspace.organization.code}</p></>}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => (
            <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }} title={collapsed ? item.label : undefined} className={`focus-ring flex h-10 w-full items-center rounded-lg text-sm transition ${collapsed ? "justify-center" : "gap-3 px-3"} ${tab === item.id ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "text-[var(--muted)] hover:bg-[var(--ink-panel)] hover:text-[var(--text)]"}`}>
              <Icon name={item.icon} size={17} /> {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <button onClick={logout} className={`focus-ring flex h-10 w-full items-center rounded-lg text-sm text-[var(--muted)] hover:bg-red-500/10 hover:text-[var(--danger)] ${collapsed ? "justify-center" : "gap-3 px-3"}`}><Icon name="logout" size={17} />{!collapsed && "Logout"}</button>
          <button onClick={() => setCollapsed((value) => !value)} className={`focus-ring hidden h-10 w-full items-center rounded-lg text-sm text-[var(--faint)] hover:bg-[var(--ink-panel)] lg:flex ${collapsed ? "justify-center" : "gap-3 px-3"}`}><Icon name="chevron" size={17} className={collapsed ? "" : "rotate-180"} />{!collapsed && "Collapse"}</button>
        </div>
      </aside>
      <div className={`transition-[margin] duration-200 ${collapsed ? "lg:ml-[72px]" : "lg:ml-64"}`}>
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-[var(--ink)]/90 px-5 backdrop-blur md:px-8">
          <button onClick={() => setMobileOpen(true)} className="focus-ring rounded-lg p-2 text-[var(--muted)] lg:hidden" aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="hidden items-center gap-2 text-xs text-[var(--faint)] sm:flex"><span>{workspace.organization.name}</span><span>·</span><span className="capitalize">{workspace.current_user.role.replaceAll("_", " ")}</span></div>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="text-xs font-medium">{workspace.current_user.full_name}</p><p className="text-[10px] text-[var(--faint)]">{workspace.current_user.email}</p></div><span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--teal)]/30 bg-[var(--teal-soft)] text-[10px] font-semibold text-[var(--teal)]">{workspace.current_user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span></div>
          </div>
        </div>
        {tab === "home" && <Dashboard workspace={workspace} records={records} voiceJobs={voiceJobs} loading={recordsLoading} error={recordsError} refresh={() => loadRecords()} />}
        {tab === "users" && <UsersPage />}
        {tab === "network" && <NetworkPage />}
        {tab === "library" && <LibraryPage />}
        {tab === "settings" && <SettingsPage workspace={workspace} />}
      </div>
    </div>
  );
}
