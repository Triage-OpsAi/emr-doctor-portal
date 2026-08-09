"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddMedicationModal, AddRecordModal, Modal, ReportUploadModal, VoiceEncounterModal } from "@/components/PortalApp";
import { Icon, type IconName } from "@/components/Icon";
import { TriCareLogo } from "@/components/TriCareLogo";
import { apiFetch, hasSession, logoutSession } from "@/lib/api";
import { AUDIT_EVENTS, flushAuditQueue, queueAuditEvent } from "@/lib/audit";
import type {
  ClinicalUser,
  DischargeUpload,
  HandoverUpload,
  PatientChart,
  PatientDashboardRecord,
  PatientSectionReview,
  VoiceJob,
  Workspace,
} from "@/lib/types";

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

function SummaryBox({
  itemKey,
  title,
  value,
  review,
  className,
  editMode,
  onChange,
  onDelete,
  children,
}: {
  itemKey: string;
  title: string;
  value: string;
  review?: PatientSectionReview;
  className: string;
  editMode: boolean;
  onChange: (itemKey: string, value: string) => void;
  onDelete: (itemKey: string, title: string) => void;
  children: React.ReactNode;
}) {
  if (review?.deleted_items?.includes(itemKey)) return null;
  const override = review?.item_overrides?.[itemKey];

  return (
    <div className={`relative ${className}`}>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {!review?.is_approved && (
          <button
            type="button"
            onClick={() => onDelete(itemKey, title)}
            className="focus-ring inline-flex items-center gap-1 rounded-md border border-red-100 bg-white/95 px-1.5 py-1 text-[9px] font-semibold text-red-500 shadow-sm hover:border-red-300"
            aria-label={`Delete ${title}`}
          >
            <Icon name="trash" size={10} /> Delete
          </button>
        )}
      </div>
      <div className="pt-6">
        {editMode ? (
          <textarea
            defaultValue={override || value}
            onChange={(event) => onChange(itemKey, event.target.value)}
            rows={Math.max(3, Math.min(10, points(override || value).length + 1))}
            aria-label={`Edit ${title}`}
            className="focus-ring min-h-24 w-full resize-y rounded-lg border border-[#8bcac0] bg-white p-3 text-sm leading-6 text-[#26353b]"
          />
        ) : override ? (
          <>
            <p className="mb-3 text-xs font-bold">{title}</p>
            <PointList value={override} />
          </>
        ) : children}
      </div>
    </div>
  );
}

function InlineContent({
  editing,
  value,
  onChange,
  children,
}: {
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  if (!editing) return <>{children}</>;
  return (
    <textarea
      defaultValue={value}
      onChange={(event) => onChange(event.target.value)}
      rows={Math.max(3, Math.min(14, points(value).length + 2))}
      className="focus-ring w-full resize-y rounded-lg border border-[#8bcac0] bg-white p-3 text-sm leading-6 text-[#26353b]"
    />
  );
}

function SmallDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-1.5 py-1 text-[9px] font-semibold text-red-500 hover:border-red-300"
    >
      <Icon name="trash" size={10} /> Delete
    </button>
  );
}

function ClinicalSection({ id, title, action, children }: { id?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 my-5 rounded-xl border border-[#dfe7e6] bg-white p-5 shadow-[0_4px_16px_rgba(35,58,55,.04)]">
      <div className="mb-5 flex items-center justify-between border-b border-[#e8eeed] pb-4">
        <h2 className="text-base font-bold text-[#18232f]">{title}</h2>
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
  const labels: Record<string, string> = {
    queued: "In progress",
    processing: "In progress",
    transcribing: "In progress",
    generating_summary: "In progress",
    generating_pdf: "In progress",
    pending_review: "Needs review",
    needs_reupload: "New file needed",
  };
  return <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide ${styles}`}>{labels[status] || status.replaceAll("_", " ")}</span>;
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
  const [paused, setPaused] = useState(false);
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
      setPaused(false);
      queueAuditEvent({ action: AUDIT_EVENTS.AUDIO_CAPTURE_STARTED, resource_type: "discharge_audio", patient_id: patientId });
    } catch {
      setError("Microphone permission is required to record discharge instructions.");
    }
  }

  function stop() {
    if (["recording", "paused"].includes(recorder.current?.state || "")) recorder.current?.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
    setPaused(false);
    queueAuditEvent({ action: AUDIT_EVENTS.AUDIO_CAPTURE_STOPPED, resource_type: "discharge_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  function pause() {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPaused(true);
    queueAuditEvent({ action: "audio.paused", resource_type: "discharge_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  function resume() {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    setPaused(false);
    queueAuditEvent({ action: "audio.resumed", resource_type: "discharge_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audio) {
      setError("Record the discharge instructions first.");
      return;
    }
    const contentType = (audio.type || "audio/webm").split(";", 1)[0];
    setSubmitting(true);
    setError("");
    try {
      setStage("Saving recording…");
      const upload = await apiFetch<DischargeUpload>(`/patients/${patientId}/discharge-summaries`, {
        method: "POST",
        body: JSON.stringify({
          content_type: contentType,
          file_size: audio.size,
          language_code: "unknown",
        }),
      });
      setStage("Saving recording…");
      const response = await fetch(upload.upload_url, {
        method: "PUT",
        headers: { "Content-Type": upload.content_type },
        body: audio,
      });
      if (!response.ok) throw new Error("The recording could not be saved.");
      queueAuditEvent({ action: "audio.uploaded", resource_type: "discharge_summary", resource_id: upload.job_id, patient_id: patientId, outcome: "queued", event_metadata: { bytes: audio.size } });
      setStage("Preparing summary…");
      await apiFetch(`/patients/${patientId}/discharge-summaries/${upload.job_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ etag: response.headers.get("etag") }),
      });
      onDone();
      onClose();
    } catch (reason) {
      queueAuditEvent({ action: "delivery.retry_required", resource_type: "discharge_audio", patient_id: patientId, outcome: "failure", event_metadata: { reason: reason instanceof Error ? reason.message : "upload_failed" } });
      setError(reason instanceof Error ? reason.message : "Unable to start the discharge summary.");
    } finally {
      setSubmitting(false);
      setStage("");
    }
  }

  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <Modal title="Generate discharge summary" subtitle="Record the discharge instructions. The patient chart will be included automatically." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-6">
        <div className="rounded-xl border border-[#dfe7e6] bg-[#f7f9f9] p-6 text-center">
          <p className="font-mono text-xs text-[#829096]">{recording ? `${paused ? "Paused" : "Recording"} ${time}` : audio ? "Instructions recorded" : "Ready to record"}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!recording && !audio && (
              <button type="button" onClick={start} className={actionButton}>
                <Icon name="mic" /> Start recording
              </button>
            )}
            {recording && (
              <>
                <button type="button" onClick={paused ? resume : pause} className={actionButton}><span className="font-bold">{paused ? "▶" : "Ⅱ"}</span> {paused ? "Resume" : "Pause"}</button>
                <button type="button" onClick={stop} className="focus-ring rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white">Stop recording</button>
              </>
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

function HandoverRecordingModal({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone: () => void }) {
  const [users, setUsers] = useState<ClinicalUser[]>([]);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch<ClinicalUser[]>("/patients/handover-recipients")
      .then((items) => setUsers(items.filter((item) => item.is_active && !item.is_current_user)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load clinicians."));
    return () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users
      .filter((user) => !value || `${user.full_name} ${user.role} ${user.email}`.toLowerCase().includes(value))
      .slice(0, 8);
  }, [query, users]);

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
      setPaused(false);
      queueAuditEvent({ action: AUDIT_EVENTS.AUDIO_CAPTURE_STARTED, resource_type: "handover_audio", patient_id: patientId });
    } catch {
      setError("Microphone permission is required to prepare a handover.");
    }
  }

  function stop() {
    if (["recording", "paused"].includes(recorder.current?.state || "")) recorder.current?.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRecording(false);
    setPaused(false);
    queueAuditEvent({ action: AUDIT_EVENTS.AUDIO_CAPTURE_STOPPED, resource_type: "handover_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  function pause() {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPaused(true);
    queueAuditEvent({ action: "audio.paused", resource_type: "handover_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  function resume() {
    if (recorder.current?.state !== "paused") return;
    recorder.current.resume();
    timer.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    setPaused(false);
    queueAuditEvent({ action: "audio.resumed", resource_type: "handover_audio", patient_id: patientId, event_metadata: { duration_seconds: elapsed } });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audio) {
      setError("Record the clinical handover first.");
      return;
    }
    const contentType = (audio.type || "audio/webm").split(";", 1)[0];
    setSubmitting(true);
    setError("");
    try {
      setStage("Saving recording…");
      const upload = await apiFetch<HandoverUpload>(`/patients/${patientId}/handovers`, {
        method: "POST",
        body: JSON.stringify({
          content_type: contentType,
          file_size: audio.size,
          language_code: "unknown",
          handed_over_to: recipientId || null,
        }),
      });
      setStage("Saving recording…");
      const response = await fetch(upload.upload_url, {
        method: "PUT",
        headers: { "Content-Type": upload.content_type },
        body: audio,
      });
      if (!response.ok) throw new Error("The recording could not be saved.");
      queueAuditEvent({ action: "audio.uploaded", resource_type: "handover", resource_id: upload.job_id, patient_id: patientId, outcome: "queued", event_metadata: { bytes: audio.size } });
      setStage("Preparing handover…");
      await apiFetch(`/patients/${patientId}/handovers/${upload.job_id}/complete`, {
        method: "POST",
        body: JSON.stringify({ etag: response.headers.get("etag") }),
      });
      onDone();
      onClose();
    } catch (reason) {
      queueAuditEvent({ action: "delivery.retry_required", resource_type: "handover_audio", patient_id: patientId, outcome: "failure", event_metadata: { reason: reason instanceof Error ? reason.message : "upload_failed" } });
      setError(reason instanceof Error ? reason.message : "Unable to prepare the handover.");
    } finally {
      setSubmitting(false);
      setStage("");
    }
  }

  const selected = users.find((user) => user.id === recipientId);
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <Modal title="Prepare handover" subtitle="Record the update now. A receiving clinician can be selected now or assigned later." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 p-6">
        <div className="rounded-xl border border-[#dfe7e6] bg-[#f7f9f9] p-5 text-center">
          <p className="font-mono text-xs text-[#829096]">{recording ? `${paused ? "Paused" : "Recording"} ${time}` : audio ? "Handover recorded" : "Ready to record"}</p>
          <div className="mt-4 flex justify-center gap-3">
            {!recording && <button type="button" onClick={start} className={actionButton}><Icon name={audio ? "refresh" : "mic"} /> {audio ? "Record again" : "Start recording"}</button>}
            {recording && <>
              <button type="button" onClick={paused ? resume : pause} className={actionButton}><span className="font-bold">{paused ? "▶" : "Ⅱ"}</span> {paused ? "Resume" : "Pause"}</button>
              <button type="button" onClick={stop} className="focus-ring rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white">Stop recording</button>
            </>}
          </div>
          {previewUrl && <audio controls src={previewUrl} className="mt-4 w-full" />}
        </div>
        <div>
          <label htmlFor="handover-recipient" className="text-xs text-[#51616b]">Hand over to <span className="text-[#9aa7ac]">(optional)</span></label>
          <div className="relative mt-2">
            <Icon name="search" size={14} className="absolute left-3 top-3.5 text-[#9aa7ac]" />
            <input
              id="handover-recipient"
              value={selected ? selected.full_name : query}
              onChange={(event) => {
                setRecipientId("");
                setQuery(event.target.value);
              }}
              placeholder="Search clinician by name, role, or email"
              autoComplete="off"
              className="focus-ring h-11 w-full rounded-lg border border-[#dfe7e6] bg-white pl-9 pr-3 text-sm"
            />
            {!recipientId && (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-[#dfe7e6] bg-white p-1 shadow-xl">
                {matches.map((user) => (
                  <button key={user.id} type="button" onClick={() => { setRecipientId(user.id); setQuery(user.full_name); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef5f3]">
                    <span className="block text-sm font-semibold">{user.full_name}</span>
                    <span className="text-[10px] capitalize text-[#829096]">{user.role} · {user.email}</span>
                  </button>
                ))}
                {!matches.length && <p className="px-3 py-3 text-xs text-[#9aa7ac]">No matching clinicians.</p>}
              </div>
            )}
          </div>
        </div>
        <p className="text-xs leading-5 text-[#51616b]">The draft is prepared even when no recipient is available. A clinician can be assigned later from the handover tab.</p>
        {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={actionButton}>Cancel</button>
          <button disabled={!audio || submitting} className={primaryButton}>{submitting ? stage : "Prepare handover"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssignHandoverModal({
  patientId,
  handoverId,
  onClose,
  onDone,
}: {
  patientId: string;
  handoverId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [users, setUsers] = useState<ClinicalUser[]>([]);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ClinicalUser[]>("/patients/handover-recipients")
      .then((items) => setUsers(items.filter((item) => item.is_active)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load clinicians."));
  }, []);

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users
      .filter((user) => !value || `${user.full_name} ${user.role} ${user.email}`.toLowerCase().includes(value))
      .slice(0, 10);
  }, [query, users]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientId) {
      setError("Select the person receiving this handover.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/patients/${patientId}/handovers/${handoverId}/recipient`, {
        method: "PATCH",
        body: JSON.stringify({ handed_over_to: recipientId }),
      });
      queueAuditEvent({
        action: "handover.edit_made",
        resource_type: "handover",
        resource_id: handoverId,
        patient_id: patientId,
        changes: { handed_over_to: recipientId },
      });
      onDone();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to assign the handover.");
    } finally {
      setSubmitting(false);
    }
  }

  const selected = users.find((user) => user.id === recipientId);
  return (
    <Modal title="Assign handover" subtitle="Choose the nurse, doctor, or other clinical team member receiving this patient." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-6">
        <div>
          <label htmlFor="assign-handover-recipient" className="text-xs text-[#51616b]">Receiving clinician</label>
          <div className="relative mt-2">
            <Icon name="search" size={14} className="absolute left-3 top-3.5 text-[#9aa7ac]" />
            <input
              id="assign-handover-recipient"
              value={selected ? selected.full_name : query}
              onChange={(event) => {
                setRecipientId("");
                setQuery(event.target.value);
              }}
              placeholder="Search by name, role, or email"
              autoComplete="off"
              className="focus-ring h-11 w-full rounded-lg border border-[#dfe7e6] bg-white pl-9 pr-3 text-sm"
            />
            {!recipientId && (
              <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#dfe7e6] bg-white p-1">
                {matches.map((user) => (
                  <button key={user.id} type="button" onClick={() => { setRecipientId(user.id); setQuery(user.full_name); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef5f3]">
                    <span className="block text-sm font-semibold">{user.full_name}</span>
                    <span className="text-[10px] capitalize text-[#829096]">{user.role} · {user.email}</span>
                  </button>
                ))}
                {!matches.length && <p className="px-3 py-3 text-xs text-[#9aa7ac]">No matching clinicians.</p>}
              </div>
            )}
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={actionButton}>Cancel</button>
          <button disabled={!recipientId || submitting} className={primaryButton}>{submitting ? "Assigning…" : "Assign handover"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Vitals + medication-mix helpers (presentational only)                 */
/* ---------------------------------------------------------------------- */

type VitalReading = { label: string; value: string; unit?: string; capturedAt?: string; capturedBy?: string };

function readVitals(chart: PatientChart | null): VitalReading[] {
  const raw = (chart as unknown as { vitals?: Record<string, string | number> } | null)?.vitals;
  const fields: Array<[string, string, string | undefined, RegExp]> = [
    ["bp", "BP", "mmHg", /(?:\bBP\b|blood pressure)\s*(?:is|was|of|[:=-])*\s*(\d{2,3}\s*\/\s*\d{2,3})/i],
    ["hr", "HR", "bpm", /(?:\bHR\b|heart rate|pulse)\s*(?:is|was|of|[:=-])*\s*(\d{2,3})/i],
    ["spo2", "SpO₂", "%", /(?:SpO2|SpO₂|oxygen saturation)\s*(?:is|was|of|[:=-])*\s*(\d{2,3})\s*%?/i],
    ["rr", "RR", "breaths/min", /(?:\bRR\b|respiratory rate)\s*(?:is|was|of|[:=-])*\s*(\d{1,3})/i],
    ["temp", "Temp", "°C", /(?:temperature|\btemp\b)\s*(?:is|was|of|[:=-])*\s*(\d{2,3}(?:\.\d+)?)\s*°?\s*[CF]?/i],
    ["pain_score", "Pain Score", undefined, /(?:pain score|pain)\s*(?:is|was|of|[:=-])*\s*(\d{1,2})(?:\s*\/\s*10)?/i],
  ];
  return fields.map(([key, label, unit, pattern]) => {
    if (raw && raw[key] != null) return { label, unit, value: String(raw[key]) };
    for (const record of chart?.records || []) {
      const text = [record.structured_note?.objective, record.structured_note?.subjective].filter(Boolean).join(" ");
      const match = text.match(pattern);
      if (match) {
        return {
          label,
          unit,
          value: match[1].replace(/\s+/g, ""),
          capturedAt: record.created_at,
          capturedBy: record.captured_by,
        };
      }
    }
    return { label, unit, value: "—" };
  });
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

const TOP_TABS = [
  { id: "summary", label: "Overview", icon: "home" },
  { id: "timeline", label: "Timeline", icon: "activity" },
  { id: "clinical", label: "Clinical", icon: "file" },
  { id: "medications", label: "Medications", icon: "pill" },
  { id: "diagnoses", label: "Diagnoses", icon: "shield" },
  { id: "reports", label: "Reports", icon: "library" },
  { id: "documents", label: "Documents", icon: "file" },
  { id: "handover", label: "Handover", icon: "users" },
] as const;

type PatientTab = (typeof TOP_TABS)[number]["id"];

const SIDEBAR_LINKS: Array<{ label: string; icon: IconName; tab: PatientTab; group: "Clinical" | "Records"; badge?: (n: { orders: number; reports: number }) => number | undefined }> = [
  { label: "Overview", icon: "home", tab: "summary", group: "Clinical" },
  { label: "Encounters", icon: "activity", tab: "timeline", group: "Clinical" },
  { label: "Clinical Notes", icon: "file", tab: "clinical", group: "Clinical" },
  { label: "Orders", icon: "library", tab: "medications", group: "Clinical", badge: (n) => n.orders },
  { label: "Medications", icon: "pill", tab: "medications", group: "Clinical" },
  { label: "Diagnostics", icon: "activity", tab: "reports", group: "Clinical" },
  { label: "Reports", icon: "file", tab: "reports", group: "Records", badge: (n) => n.reports },
  { label: "Discharge Summary", icon: "mic", tab: "documents", group: "Records" },
  { label: "Prepare Handover", icon: "users", tab: "handover", group: "Records" },
  { label: "EMR Records", icon: "file", tab: "clinical", group: "Records" },
];

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
      const updated = {
        full_name: String(form.get("full_name") || ""),
        age: form.get("age") ? Number(form.get("age")) : null,
        phone: String(form.get("phone") || "") || null,
        gender: String(form.get("gender") || "") || null,
        encounter_number: String(form.get("encounter_number") || "") || null,
        ward_number: String(form.get("ward_number") || "") || null,
        bed_number: String(form.get("bed_number") || "") || null,
      };
      await apiFetch(`/patients/${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify(updated),
      });
      queueAuditEvent({
        action: "patient.edit_made",
        resource_type: "patient",
        resource_id: patient.id,
        patient_id: patient.id,
        encounter_id: patient.encounter_id,
        changes: {
          before: {
            full_name: patient.patient_name,
            age: patient.age,
            phone: patient.phone,
            gender: patient.gender,
            encounter_number: patient.encounter_number,
            ward_number: patient.ward_number,
            bed_number: patient.bed_number,
          },
          after: updated,
        },
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
        <label className="text-xs text-[var(--muted)]">Age<input name="age" type="number" min="0" max="130" defaultValue={patient.age ?? ""} className="focus-ring mt-2 h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
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

export function PatientPage({ clientName, workspaceId, patientId, visitId }: { clientName: string; workspaceId: string; patientId: string; visitId?: string }) {
  const router = useRouter();
  const chartViewed = useRef(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [patient, setPatient] = useState<PatientDashboardRecord | null>(null);
  const [chart, setChart] = useState<PatientChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"report" | "record" | "voice-encounter" | "medication" | "discharge" | "handover" | "edit-patient" | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioLoading, setAudioLoading] = useState("");
  const [approving, setApproving] = useState("");
  const [activeTab, setActiveTab] = useState<PatientTab>("summary");
  const [encounterQueued, setEncounterQueued] = useState(false);
  const [assigningHandover, setAssigningHandover] = useState<string | null>(null);
  const [editingTab, setEditingTab] = useState<PatientTab | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [sectionBusy, setSectionBusy] = useState("");

  const workspacePath = `/${clientName}/${workspaceId}`;

  const load = useCallback(async () => {
    try {
      setError("");
      const [workspaceData, patients, chartData] = await Promise.all([
        apiFetch<Workspace>("/doctor/workspace"),
        apiFetch<PatientDashboardRecord[]>("/doctor/patients"),
        apiFetch<PatientChart>(`/patients/${patientId}/chart${visitId ? `?visit_id=${encodeURIComponent(visitId)}` : ""}`),
      ]);
      const selected = patients.find((item) => item.id === patientId);
      if (!selected) throw new Error("Patient was not found in this hospital.");
      setWorkspace(workspaceData);
      setPatient(selected);
      setChart(chartData);
      if (!chartViewed.current) {
        chartViewed.current = true;
        queueAuditEvent({ action: "document.viewed", resource_type: "patient_chart", resource_id: patientId, patient_id: patientId });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load this patient.");
    } finally {
      setLoading(false);
    }
  }, [patientId, visitId]);

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
    const handoverPending = chart?.handovers?.some((job) => ["queued", "transcribing", "generating_summary"].includes(job.status));
    if (!reportPending && !dischargePending && !handoverPending) return;
    const handle = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(handle);
  }, [chart?.discharge_summaries, chart?.handovers, chart?.reports, load]);

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
  const selectedVisit = chart?.selected_visit || null;
  const note = latest?.structured_note || null;
  const activeSectionReview = chart?.section_reviews.find((review) => review.section_key === activeTab);
  const sectionDeleted = Boolean(activeSectionReview?.is_deleted);
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
    const seenNames = new Set(
      entered.map((medication) => medication.name.trim().toLowerCase()),
    );
    const generated = chart.records.flatMap((record) =>
      (record.structured_note?.medications || []).flatMap((medication, index) => {
        const normalizedName = medication.name.trim().toLowerCase();
        if (!normalizedName || seenNames.has(normalizedName)) return [];
        seenNames.add(normalizedName);
        return [{
          id: `emr-${record.id}-${index}`,
          name: medication.name,
          dosage: medication.dosage || "—",
          frequency: medication.frequency || "—",
          duration: "—",
          status: "Documented",
        }];
      }),
    );
    return [...entered, ...generated];
  }, [chart]);
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
  const longitudinalSections = useMemo(() => {
    const definitions: Array<{ key: keyof NonNullable<typeof note>; label: string }> = [
      { key: "chief_complaint", label: "Chief complaint" },
      { key: "subjective", label: "Subjective" },
      { key: "objective", label: "Objective & vitals" },
      { key: "assessment", label: "Assessment" },
      { key: "plan", label: "Plan" },
      { key: "symptoms", label: "Symptoms" },
      { key: "diagnoses", label: "Diagnoses" },
    ];
    return definitions.map(({ key, label }) => ({
      key,
      label,
      entries: (chart?.records || []).flatMap((record) => {
        const value = record.structured_note?.[key];
        const text = Array.isArray(value) ? value.join(". ") : typeof value === "string" ? value : "";
        return text.trim() ? [{ text, record }] : [];
      }),
    }));
  }, [chart?.records]);

  async function listen(recordId: string) {
    setAudioLoading(recordId);
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/records/${recordId}/audio`);
      setAudioUrl(access.url);
      queueAuditEvent({ action: "audio.played", resource_type: "emr_record", resource_id: recordId, patient_id: patientId });
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
      queueAuditEvent({ action: "audio.played", resource_type: "discharge_summary", resource_id: jobId, patient_id: patientId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retrieve discharge instructions.");
    } finally {
      setAudioLoading("");
    }
  }

  async function listenHandover(jobId: string) {
    setAudioLoading(jobId);
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/handovers/${jobId}/audio`);
      setAudioUrl(access.url);
      queueAuditEvent({ action: "audio.played", resource_type: "handover", resource_id: jobId, patient_id: patientId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retrieve the handover recording.");
    } finally {
      setAudioLoading("");
    }
  }

  async function downloadDischarge(jobId: string) {
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/discharge-summaries/${jobId}/download`);
      window.open(access.url, "_blank", "noopener,noreferrer");
      queueAuditEvent({ action: "note.exported", resource_type: "discharge_summary", resource_id: jobId, patient_id: patientId });
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

  async function syncRecord(recordId: string) {
    setApproving(`sync-${recordId}`);
    setError("");
    try {
      await apiFetch(`/emr/records/${recordId}/sync`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sync the patient record to the EMR.");
    } finally {
      setApproving("");
    }
  }

  async function approveReport(reportId: string) {
    setApproving(`report-${reportId}`);
    setError("");
    try {
      await apiFetch(`/patients/${patientId}/reports/${reportId}/approve`, { method: "POST" });
      queueAuditEvent({ action: AUDIT_EVENTS.USER_CONFIRMATION_OR_CORRECTION, resource_type: "patient_report", resource_id: reportId, patient_id: patientId, event_metadata: { operation: "confirmed" } });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve the report summary.");
    } finally {
      setApproving("");
    }
  }

  async function approveSection(section: PatientTab) {
    setSectionBusy(`approve-${section}`);
    setError("");
    try {
      await apiFetch(`/patients/${patientId}/sections/${section}/approve`, {
        method: "POST",
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to approve this section.");
    } finally {
      setSectionBusy("");
    }
  }

  function editValue(itemKey: string, value: string) {
    setEditDrafts((current) => ({ ...current, [itemKey]: value }));
  }

  async function saveInlineEdits() {
    if (!editingTab) return;
    const entries = Object.entries(editDrafts).filter(([, value]) => value.trim());
    if (!entries.length) {
      setEditingTab(null);
      return;
    }
    setSectionBusy(`save-${editingTab}`);
    setError("");
    try {
      await Promise.all(entries.map(([itemKey, contentOverride]) => (
        apiFetch(`/patients/${patientId}/sections/${editingTab}/items/${itemKey}`, {
          method: "PATCH",
          body: JSON.stringify({ content_override: contentOverride }),
        })
      )));
      setEditDrafts({});
      setEditingTab(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the changes.");
    } finally {
      setSectionBusy("");
    }
  }

  async function deleteTabItem(section: PatientTab, itemKey: string, title: string) {
    if (!window.confirm(`Delete only the ${title} box?`)) return;
    setSectionBusy(`delete-${itemKey}`);
    setError("");
    try {
      await apiFetch(`/patients/${patientId}/sections/${section}/items/${itemKey}`, {
        method: "DELETE",
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this box.");
    } finally {
      setSectionBusy("");
    }
  }

  function sectionReview(section: PatientTab) {
    return chart?.section_reviews.find((review) => review.section_key === section);
  }

  function itemValue(section: PatientTab, itemKey: string, value: string) {
    return sectionReview(section)?.item_overrides?.[itemKey] || value;
  }

  function itemDeleted(section: PatientTab, itemKey: string) {
    return Boolean(sectionReview(section)?.deleted_items?.includes(itemKey));
  }

  async function openReport(reportId: string) {
    setError("");
    try {
      const access = await apiFetch<{ url: string }>(`/patients/${patientId}/reports/${reportId}/open`);
      window.open(access.url, "_blank", "noopener,noreferrer");
      queueAuditEvent({ action: "file.opened", resource_type: "patient_report", resource_id: reportId, patient_id: patientId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open this report.");
    }
  }

  async function logout() {
    queueAuditEvent({ action: AUDIT_EVENTS.USER_LOGOUT, event_category: "authentication", resource_type: "session" });
    await flushAuditQueue();
    await logoutSession();
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
  const sidebarActiveLabel: Record<PatientTab, string> = {
    summary: "Overview",
    timeline: "Encounters",
    clinical: "Clinical Notes",
    medications: "Medications",
    diagnoses: "Clinical Notes",
    reports: "Reports",
    documents: "Discharge Summary",
    handover: "Prepare Handover",
  };

  return (
    <div className="min-h-screen bg-[#f7f9f9] text-[#18232f]">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-[#e3e9e8] bg-white px-5 md:px-7">
        <div className="flex min-w-0 items-center gap-5">
          <button onClick={() => router.push(workspacePath)} className="focus-ring flex items-center gap-3 rounded-md text-left">
            <TriCareLogo size={40} className="shadow-sm" />
            <span className="hidden sm:block">
              <span className="block text-sm font-bold leading-tight">Tri-Care</span>
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
              <Fragment key={link.label}>
                {(index === 0 || SIDEBAR_LINKS[index - 1].group !== link.group) && (
                  <p className={`${index === 0 ? "pb-2" : "pb-2 pt-5"} px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[#718099]`}>{link.group}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(link.tab);
                    setEditingTab(null);
                    setEditDrafts({});
                  }}
                  className={
                    sidebarActiveLabel[activeTab] === link.label
                      ? "flex w-full items-center justify-between gap-3 rounded-lg bg-[#075e61] px-3 py-3 font-semibold text-white"
                      : "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-[#51616b] hover:bg-[#eef5f3]"
                  }
                >
                  <span className="flex items-center gap-3">
                    <Icon name={link.icon} size={16} /> {link.label}
                  </span>
                  {link.badge && link.badge({ orders: orders.length, reports: chart.reports.length }) ? (
                    <span className={sidebarActiveLabel[activeTab] === link.label ? "text-[10px] text-white/80" : "text-[10px] text-[#9aa7ac]"}>{link.badge({ orders: orders.length, reports: chart.reports.length })}</span>
                  ) : null}
                </button>
              </Fragment>
            ))}
            <button onClick={() => router.push(workspacePath)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[#51616b] hover:bg-[#eef5f3]">
              <Icon name="users" size={16} /> Patients
            </button>
          </nav>
        </aside>

        {/* -------------------------------------------------------------- */}
        {/* Main content                                                   */}
        {/* -------------------------------------------------------------- */}
        <main className="min-w-0 bg-[#f7f9f9] p-3 sm:p-5 lg:p-7">
          <button onClick={() => router.push(workspacePath)} className="focus-ring mb-4 flex items-center gap-2 text-xs font-semibold text-[#51616b] hover:text-[#0c716e]">
            <Icon name="chevron" size={13} className="rotate-180" /> Back to patients
          </button>

          {chart.visits.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#dfe7e6] bg-white p-3">
            <span className="text-xs font-semibold text-[#51616b]">Viewing visit</span>
            <select value={selectedVisit?.id || ""} onChange={(event) => router.push(`${workspacePath}/patient/${patientId}?visit=${encodeURIComponent(event.target.value)}`)} className="focus-ring h-10 min-w-56 rounded-lg border border-[#dfe7e6] bg-white px-3 text-xs text-[#18232f]">
              {!selectedVisit && <option value="">All visits</option>}
              {chart.visits.map((visit) => <option key={visit.id} value={visit.id}>Visit {visit.visit_number} · {new Date(visit.created_at).toLocaleString()}</option>)}
            </select>
            <button type="button" onClick={() => router.push(`${workspacePath}/patient/${patientId}`)} className={actionButton}>View complete history</button>
          </div>}

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
                          <span className="text-[#9aa7ac]">Visit Number:</span> {selectedVisit ? `Visit ${selectedVisit.visit_number}${selectedVisit.encounter_number ? ` · ${selectedVisit.encounter_number}` : ""}` : patient.encounter_number || latest?.encounter_id.slice(0, 10).toUpperCase() || "—"}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Visit Date &amp; Time:</span> {selectedVisit ? new Date(selectedVisit.created_at).toLocaleString() : patient.last_visit_at ? new Date(patient.last_visit_at).toLocaleString() : "—"}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Care Provider:</span> {selectedVisit?.doctor_name || patient.doctor_name || workspace.current_user.full_name}
                        </p>
                        <p>
                          <span className="text-[#9aa7ac]">Ward / Bed:</span> {selectedVisit?.ward_number || patient.ward_number || "—"} / {selectedVisit?.bed_number || patient.bed_number || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <span className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold ${!latest ? "bg-amber-50 text-amber-700" : latest.status === "pending_review" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                      <span className={`h-2 w-2 rounded-full ${!latest ? "bg-amber-500" : latest.status === "pending_review" ? "bg-red-500" : "bg-emerald-500"}`} />
                      {!latest ? "Awaiting record" : latest.status === "pending_review" ? "Needs review" : "Approved"}
                    </span>
                    <button onClick={() => setAction("voice-encounter")} className={primaryButton}>
                      <Icon name={selectedVisit && !latest ? "mic" : "plus"} size={14} /> {selectedVisit && !latest ? "Record this visit" : "New Encounter"}
                    </button>
                    <details className="relative">
                      <summary className={`${actionButton} cursor-pointer list-none bg-white`}>
                        ••• <span className="sr-only">Patient actions</span>
                      </summary>
                      <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[#e3e9e8] bg-white p-2 shadow-2xl">
                        {latest?.status === "pending_review" && (
                          <button onClick={() => approveRecord(latest.id)} disabled={Boolean(approving)} className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                            <Icon name="shield" size={15} /> {approving === `record-${latest.id}` ? "Approving…" : "Approve patient record"}
                          </button>
                        )}
                        {latest?.status === "approved" && (
                          <button onClick={() => syncRecord(latest.id)} disabled={Boolean(approving)} className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                            <Icon name="refresh" size={15} /> {approving === `sync-${latest.id}` ? "Syncing..." : "Sync to EMR"}
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
                        <button onClick={() => { setActiveTab("handover"); setAction("handover"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-[#51616b] hover:bg-[#f7f9f9]">
                          <Icon name="users" size={15} /> Prepare handover
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                <nav className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-[#dfe7e6] bg-white p-1 text-xs text-[#65747a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {TOP_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        setEditingTab(null);
                        setEditDrafts({});
                      }}
                      className={activeTab === tab.id ? "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg bg-[#e8f5f2] px-3 font-semibold text-[#0c716e] shadow-sm" : "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 hover:bg-[#f7f9f9] hover:text-[#0c716e]"}
                    >
                      <Icon name={tab.icon as IconName} size={14} /> {tab.label}
                    </button>
                  ))}
                </nav>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e9e8] bg-[#f7f9f9] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#18232f]">{TOP_TABS.find((item) => item.id === activeTab)?.label}</p>
                    <p className="mt-1 text-[10px] text-[#829096]">
                      {activeSectionReview?.is_approved
                        ? `Approved${activeSectionReview.approved_by ? ` by ${activeSectionReview.approved_by}` : ""}`
                        : `Patient EMR approved ${chart.approval_percentage}%`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {editingTab === activeTab ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditingTab(null); setEditDrafts({}); }}
                          disabled={Boolean(sectionBusy)}
                          className={actionButton}
                        >
                          Cancel
                        </button>
                        <button type="button" onClick={() => void saveInlineEdits()} disabled={Boolean(sectionBusy)} className={primaryButton}>
                          <Icon name="file" size={13} />
                          {sectionBusy === `save-${activeTab}` ? "Saving…" : "Save changes"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingTab(activeTab); setEditDrafts({}); }}
                        disabled={Boolean(sectionBusy)}
                        className={actionButton}
                      >
                        <Icon name="file" size={13} /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void approveSection(activeTab)}
                      disabled={Boolean(sectionBusy) || Boolean(activeSectionReview?.is_approved) || sectionDeleted}
                      className={activeSectionReview?.is_approved ? actionButton : primaryButton}
                    >
                      <Icon name="shield" size={13} />
                      {activeSectionReview?.is_approved ? "Approved" : sectionBusy === `approve-${activeTab}` ? "Approving…" : "Approve all"}
                    </button>
                  </div>
                </div>

                {sectionDeleted && (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-600">
                    This section is unavailable.
                  </div>
                )}

                <div className={sectionDeleted ? "hidden" : ""}>
                <div className={activeTab === "summary" ? "mt-5 grid gap-3 md:grid-cols-3" : "hidden"}>
                  <SummaryBox
                    itemKey="chief-complaint"
                    title="Chief Complaint"
                    value={note?.chief_complaint || patient.subject || "Not documented"}
                    review={activeSectionReview}
                    className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-rose-500">
                      <Icon name="activity" size={13} /> Chief Complaint
                    </div>
                    <p className="mt-2 text-sm leading-5">{note?.chief_complaint || patient.subject || "Not documented"}</p>
                  </SummaryBox>
                  <SummaryBox
                    itemKey="primary-diagnosis"
                    title="Primary Diagnosis"
                    value={diagnosisPoints[0] || "Not documented"}
                    review={activeSectionReview}
                    className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-violet-500">
                      <Icon name="file" size={13} /> Primary Diagnosis
                    </div>
                    <p className="mt-2 text-sm leading-5">{diagnosisPoints[0] || "Not documented"}</p>
                  </SummaryBox>
                  <SummaryBox
                    itemKey="status"
                    title="Status"
                    value={latest?.status === "pending_review" ? "Needs review" : latest?.status === "synced_to_emr" ? "Synced" : latest?.status.replaceAll("_", " ") || patient.status.replaceAll("_", " ")}
                    review={activeSectionReview}
                    className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-sky-600">
                      <Icon name="shield" size={13} /> Status
                    </div>
                    <p className="mt-2 text-sm font-semibold capitalize">{latest?.status === "pending_review" ? "Needs review" : latest?.status === "synced_to_emr" ? "Synced" : latest?.status.replaceAll("_", " ") || patient.status.replaceAll("_", " ")}</p>
                  </SummaryBox>
                </div>

                <section className={activeTab === "summary" ? "mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5" : "hidden"}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="pill" size={17} /></span>
                    <h2 className="text-sm font-bold text-emerald-900">Treatment Plan</h2>
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
                        const itemKey = `treatment-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
                        return (
                          <SummaryBox
                            key={section.title}
                            itemKey={itemKey}
                            title={section.title}
                            value={section.items.join("\n")}
                            review={activeSectionReview}
                            className={`rounded-xl border p-4 ${tones[section.tone]}`}
                            editMode={editingTab === "summary"}
                            onChange={editValue}
                            onDelete={(key, title) => void deleteTabItem("summary", key, title)}
                          >
                            <h3 className="flex items-center gap-2 text-xs font-bold"><Icon name={section.icon} size={15} /> {section.title}<span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[9px]">{section.items.length}</span></h3>
                            <ul className="mt-3 space-y-2.5">
                              {section.items.map((item, index) => (
                                <li key={`${item}-${index}`} className="grid grid-cols-[8px_1fr] gap-2 text-sm leading-5 text-[#26353b]"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#19a77e]" /><span>{item}</span></li>
                              ))}
                            </ul>
                          </SummaryBox>
                        );
                      })}
                    </div>
                  ) : <p className="mt-4 text-sm text-[#9aa7ac]">No treatment plan documented.</p>}
                </section>

                {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</p>}
                {audioUrl && (
                  <div className="mt-5 rounded-lg border border-[#dfe7e6] bg-[#f7f9f9] p-4">
                    <p className="mb-2 font-mono text-[9px] uppercase tracking-wide text-[#0c716e]">Consultation recording</p>
                    <audio controls autoPlay src={audioUrl} className="w-full" />
                  </div>
                )}

                <div className={activeTab === "summary" ? "mt-6 grid gap-4 lg:grid-cols-2" : "hidden"}>
                  <SummaryBox
                    itemKey="clinical-summary"
                    title="Clinical Summary"
                    value={note?.subjective || note?.assessment || "No clinical summary documented."}
                    review={activeSectionReview}
                    className="rounded-2xl border border-[#e3e9e8] p-5"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
                    <h3 className="mb-3 text-sm font-bold">Clinical Summary</h3>
                    <PointList value={note?.subjective || note?.assessment} empty="No clinical summary documented." />
                  </SummaryBox>
                  <SummaryBox
                    itemKey="patient-vitals"
                    title="Patient Vitals"
                    value={vitals.map((vital) => `${vital.label}: ${vital.value}${vital.unit ? ` ${vital.unit}` : ""}`).join("\n")}
                    review={activeSectionReview}
                    className="rounded-2xl border border-[#e3e9e8] p-5"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
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
                    {vitals.some((vital) => vital.capturedAt) && (
                      <p className="mt-3 text-[9px] text-[#9aa7ac]">
                        Automatically captured from the latest clinical encounter ·{" "}
                        {new Date(vitals.find((vital) => vital.capturedAt)?.capturedAt || "").toLocaleString()} by{" "}
                        {vitals.find((vital) => vital.capturedBy)?.capturedBy || workspace.current_user.full_name}
                      </p>
                    )}
                  </SummaryBox>
                </div>

                <div className={activeTab === "summary" ? "mt-4 grid gap-4 lg:grid-cols-2" : "hidden"}>
                  <SummaryBox
                    itemKey="active-diagnoses"
                    title="Active Diagnoses"
                    value={diagnosisPoints.join("\n") || "No diagnosis documented."}
                    review={activeSectionReview}
                    className="rounded-2xl border border-[#e3e9e8] p-5"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
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
                  </SummaryBox>
                  <SummaryBox
                    itemKey="allergies-risk-factors"
                    title="Allergies & Risk Factors"
                    value={["No known drug allergies", ...(note?.symptoms || [])].join("\n")}
                    review={activeSectionReview}
                    className="rounded-2xl border border-[#e3e9e8] p-5"
                    editMode={editingTab === "summary"}
                    onChange={editValue}
                    onDelete={(itemKey, title) => void deleteTabItem("summary", itemKey, title)}
                  >
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
                  </SummaryBox>
                </div>
              </div>

              {activeTab === "timeline" && <ClinicalSection id="consults" title="Timeline · IPD Consults">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-y border-[#eef2f1] bg-[#f7f9f9] text-[#9aa7ac]">
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Encounter summary</th>
                        <th className="px-3 py-2 font-semibold">Captured by</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Recording</th>
                        <th className="px-3 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedVisit ? chart.visits.filter((visit) => visit.id === selectedVisit.id) : chart.visits).filter((visit) => visit.encounter_count === 0).map((visit) => (
                        <tr key={visit.id} className="border-b border-[#eef2f1] bg-amber-50/40">
                          <td className="px-3 py-3">{new Date(visit.created_at).toLocaleString()}</td>
                          <td className="max-w-lg px-3 py-3"><p className="font-medium">{visit.summary}</p>{visit.department && <p className="mt-1 text-[10px] text-[#9aa7ac]">{visit.department}</p>}</td>
                          <td className="px-3 py-3 text-[#51616b]">{visit.doctor_name}</td>
                          <td className="px-3 py-3 uppercase text-amber-700">Awaiting record</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3"><button type="button" onClick={() => router.push(`${workspacePath}/patient/${patientId}?visit=${encodeURIComponent(visit.id)}`)} className="font-semibold text-[#0c716e] hover:underline">Open visit</button></td>
                        </tr>
                      ))}
                      {chart.records.map((record) => {
                        const itemKey = `encounter-${record.id}`;
                        if (itemDeleted("timeline", itemKey)) return null;
                        const baseValue = record.encounter_summary || record.structured_note?.chief_complaint || "Clinical encounter";
                        const value = itemValue("timeline", itemKey, baseValue);
                        return <tr key={record.id} className="border-b border-[#eef2f1]">
                          <td className="px-3 py-3">{new Date(record.created_at).toLocaleString()}</td>
                          <td className="max-w-lg px-3 py-3">
                            <InlineContent editing={editingTab === "timeline"} value={value} onChange={(next) => editValue(itemKey, next)}>
                              <p className="whitespace-pre-wrap font-medium">{value}</p>
                            </InlineContent>
                            {record.department && <p className="mt-1 text-[10px] text-[#9aa7ac]">{record.department}</p>}
                          </td>
                          <td className="px-3 py-3 text-[#51616b]">{record.captured_by || patient.doctor_name || workspace.current_user.full_name}</td>
                          <td className="px-3 py-3 uppercase text-[#0c716e]">{record.status === "pending_review" ? "Needs review" : record.status === "synced_to_emr" ? "Synced" : record.status.replaceAll("_", " ")}</td>
                          <td className="px-3 py-3">{record.audio_available ? <button onClick={() => listen(record.id)} className="text-[#0c716e] hover:underline">Listen</button> : "—"}</td>
                          <td className="px-3 py-3">{!sectionReview("timeline")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("timeline", itemKey, "encounter")} />}</td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              </ClinicalSection>}

              {activeTab === "diagnoses" && <ClinicalSection id="diagnosis" title="Diagnoses">
                {diagnosisPoints.length ? (
                  <ol className="space-y-2">
                    {diagnosisPoints.map((item, index) => {
                      const itemKey = `diagnosis-${index}`;
                      if (itemDeleted("diagnoses", itemKey)) return null;
                      const value = itemValue("diagnoses", itemKey, item);
                      return <li key={`${item}-${index}`} className="grid grid-cols-[24px_1fr_auto] items-start gap-2 rounded-lg border border-[#eef2f1] p-3 text-sm">
                        <span className="font-mono text-[#9aa7ac]">{index + 1}</span>
                        <InlineContent editing={editingTab === "diagnoses"} value={value} onChange={(next) => editValue(itemKey, next)}>
                          <span className="whitespace-pre-wrap">{value}</span>
                        </InlineContent>
                        {!sectionReview("diagnoses")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("diagnoses", itemKey, "diagnosis")} />}
                      </li>
                    })}
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
                        <th className="px-3 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => {
                        const rowKey = `medication-${order.id}`;
                        if (itemDeleted("medications", rowKey)) return null;
                        const fields = {
                          name: itemValue("medications", `${rowKey}-name`, order.name),
                          dosage: itemValue("medications", `${rowKey}-dosage`, order.dosage),
                          frequency: itemValue("medications", `${rowKey}-frequency`, order.frequency),
                          duration: itemValue("medications", `${rowKey}-duration`, order.duration),
                          status: itemValue("medications", `${rowKey}-status`, order.status),
                        };
                        return <tr key={order.id} className="border-b border-[#eef2f1] align-top">
                          <td className="px-3 py-3 font-mono text-[#9aa7ac]">{index + 1}</td>
                          {(["name", "dosage", "frequency", "duration", "status"] as const).map((field) => (
                            <td key={field} className={`px-3 py-3 ${field === "name" ? "font-semibold uppercase" : ""} ${field === "status" ? "text-[#0c716e]" : ""}`}>
                              <InlineContent editing={editingTab === "medications"} value={fields[field]} onChange={(next) => editValue(`${rowKey}-${field}`, next)}>
                                <span className="whitespace-pre-wrap">{fields[field]}</span>
                              </InlineContent>
                            </td>
                          ))}
                          <td className="px-3 py-3">{!sectionReview("medications")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("medications", rowKey, order.name)} />}</td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                  {!orders.length && <p className="py-4 text-sm text-[#9aa7ac]">No medication orders documented.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "reports" && <ClinicalSection id="reports" title="Diagnostics &amp; Uploaded Reports" action={<button onClick={() => setAction("report")} className={actionButton}><Icon name="upload" size={13} /> Upload report</button>}>
                <div className="space-y-3">
                  {chart.reports.map((report) => {
                    const itemKey = `report-${report.id}`;
                    if (itemDeleted("reports", itemKey)) return null;
                    const baseValue = [report.title, report.summary, ...report.key_findings].filter(Boolean).join("\n");
                    const value = itemValue("reports", itemKey, baseValue);
                    const hasOverride = value !== baseValue;
                    return <article key={report.id} className="rounded-xl border border-[#e3e9e8] p-4">
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
                          {!sectionReview("reports")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("reports", itemKey, report.title)} />}
                        </div>
                      </div>
                      {(editingTab === "reports" || hasOverride) && (
                        <div className="mt-4 rounded-lg bg-[#f7f9f9] p-3">
                          <InlineContent editing={editingTab === "reports"} value={value} onChange={(next) => editValue(itemKey, next)}>
                            <PointList value={value} />
                          </InlineContent>
                        </div>
                      )}
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
                          <HeartbeatLoader label="Preparing report…" />
                        </div>
                      )}
                      {!hasOverride && editingTab !== "reports" && report.summary && (
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
                  })}
                  {!chart.reports.length && <p className="text-sm text-[#9aa7ac]">No reports uploaded.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "handover" && <ClinicalSection id="handover" title="Clinical Handovers" action={<button onClick={() => setAction("handover")} className={primaryButton}><Icon name="mic" size={13} /> Prepare handover</button>}>
                <div className="space-y-4">
                  {(chart.handovers || []).map((job) => {
                    const data = job.summary_data || {};
                    const section = (key: string) => (Array.isArray(data[key]) ? (data[key] as string[]) : []);
                    const sections = [
                      ["Situation", "situation"],
                      ["Background", "background"],
                      ["Assessment", "assessment"],
                      ["Recommendations", "recommendations"],
                      ["Immediate priorities", "immediate_priorities"],
                      ["Risks & watchouts", "risks_and_watchouts"],
                      ["Pending actions", "pending_actions"],
                      ["Contingency plan", "contingency_plan"],
                      ["Clinical reasoning", "clinical_reasoning"],
                    ];
                    return (
                      <article key={job.id} className="rounded-xl border border-[#dfe7e6] bg-white p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold">Handover to {job.handed_over_to || "Not assigned"}</h3>
                            <p className="mt-1 text-[10px] text-[#829096]">
                              Recorded {new Date(job.recorded_at).toLocaleString()} by {job.captured_by}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAssigningHandover(job.id)} className={job.handed_over_to ? actionButton : primaryButton}>
                              <Icon name="users" size={13} /> {job.handed_over_to ? "Change recipient" : "Assign recipient"}
                            </button>
                            {job.audio_available && <button onClick={() => listenHandover(job.id)} disabled={audioLoading === job.id} className={actionButton}><Icon name="play" size={13} /> {audioLoading === job.id ? "Loading…" : "Listen"}</button>}
                            <ReportState status={job.status} />
                          </div>
                        </div>
                        {["queued", "transcribing", "generating_summary"].includes(job.status) && (
                          <div className="mt-4"><HeartbeatLoader label="Preparing handover…" /></div>
                        )}
                        {job.status === "failed" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{job.error_message || "Handover generation failed."}</p>}
                        {job.status === "ready" && (
                          <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            {sections.map(([label, key]) => {
                              const itemKey = `handover-${job.id}-${key.replaceAll("_", "-")}`;
                              if (itemDeleted("handover", itemKey)) return null;
                              const override = itemValue("handover", itemKey, "");
                              const value = override || section(key).join("\n") || "Not documented";
                              return <section key={key} className={`rounded-xl border p-4 ${key === "clinical_reasoning" ? "border-violet-100 bg-violet-50/40 lg:col-span-2" : "border-[#eef2f1] bg-[#f9fbfb]"}`}>
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <h4 className={`text-[10px] font-bold uppercase tracking-wide ${key === "clinical_reasoning" ? "text-violet-700" : "text-[#0c716e]"}`}>{label}</h4>
                                  {!sectionReview("handover")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("handover", itemKey, label)} />}
                                </div>
                                <InlineContent editing={editingTab === "handover"} value={value} onChange={(next) => editValue(itemKey, next)}>
                                {override ? <PointList value={value} /> : section(key).length ? (
                                  <ul className="space-y-2">
                                    {section(key).map((item, index) => <li key={`${item}-${index}`} className="grid grid-cols-[14px_1fr] gap-1 text-xs leading-5"><span className="text-[#0c716e]">•</span><span>{item}</span></li>)}
                                  </ul>
                                ) : <p className="text-xs text-[#9aa7ac]">Not documented</p>}
                                </InlineContent>
                              </section>
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!chart.handovers?.length && (
                    <div className="rounded-xl border border-dashed border-[#cddad8] bg-[#f9fbfb] p-8 text-center">
                      <Icon name="users" size={24} className="mx-auto text-[#0c716e]" />
                      <h3 className="mt-3 text-sm font-bold">No handover prepared yet</h3>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#829096]">Record a patient update and choose the receiving clinician.</p>
                      <button onClick={() => setAction("handover")} className={`${primaryButton} mt-4`}><Icon name="mic" size={13} /> Prepare first handover</button>
                    </div>
                  )}
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
                              {new Date(job.created_at).toLocaleString()}
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
                            <HeartbeatLoader label="Preparing discharge summary…" />
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
                            ].map(([label, key]) => {
                              const itemKey = `document-${job.id}-${key.replaceAll("_", "-")}`;
                              if (itemDeleted("documents", itemKey)) return null;
                              const override = itemValue("documents", itemKey, "");
                              const value = override || section(key).join("\n") || "Not documented";
                              return <div key={key} className="rounded-lg bg-[#f7f9f9] p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wide text-[#0c716e]">{label}</h4>
                                  {!sectionReview("documents")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("documents", itemKey, label)} />}
                                </div>
                                <InlineContent editing={editingTab === "documents"} value={value} onChange={(next) => editValue(itemKey, next)}>
                                {override ? <PointList value={value} /> : section(key).length ? (
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
                                </InlineContent>
                              </div>
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {!chart.discharge_summaries.length && <p className="text-sm text-[#9aa7ac]">No discharge summary generated yet.</p>}
                </div>
              </ClinicalSection>}

              {activeTab === "clinical" && <ClinicalSection id="emr-summary" title="EMR Summary">
                {chart.records.some((record) => record.structured_note) ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {longitudinalSections.filter((section) => section.entries.length).map((section) => (
                      <section key={section.key} className={`rounded-xl border border-[#e3e9e8] p-4 ${section.key === "chief_complaint" ? "lg:col-span-2" : ""}`}>
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#0c716e]">{section.label}</h3>
                        <div className="space-y-4">
                          {section.entries.map(({ text, record }) => {
                            const itemKey = `clinical-${section.key.replaceAll("_", "-")}-${record.id}`;
                            if (itemDeleted("clinical", itemKey)) return null;
                            const value = itemValue("clinical", itemKey, text);
                            return <article key={record.id} className="rounded-lg bg-[#f7f9f9] p-3">
                              <div className="mb-2 flex justify-end">
                                {!sectionReview("clinical")?.is_approved && <SmallDeleteButton onClick={() => void deleteTabItem("clinical", itemKey, section.label)} />}
                              </div>
                              <InlineContent editing={editingTab === "clinical"} value={value} onChange={(next) => editValue(itemKey, next)}>
                                <PointList value={value} />
                              </InlineContent>
                              <p className="mt-2 border-t border-[#e8eeed] pt-2 text-[9px] text-[#829096]">
                                Captured {new Date(record.created_at).toLocaleString()} by {record.captured_by || patient.doctor_name || workspace.current_user.full_name}
                                {record.department ? ` · ${record.department}` : ""}
                              </p>
                            </article>
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#9aa7ac]">No EMR note is available yet.</p>
                )}
              </ClinicalSection>}
                </div>

              <p className="px-5 py-4 text-[10px] text-[#9aa7ac] sm:px-7">
                Created: {latest ? new Date(latest.created_at).toLocaleString() : "—"} by {latest?.captured_by || patient.doctor_name || workspace.current_user.full_name}
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
      {action === "record" && <AddRecordModal patientId={patient.id} visitId={selectedVisit?.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "voice-encounter" && <VoiceEncounterModal patientId={patient.id} visitId={selectedVisit?.id} onClose={() => setAction(null)} onQueued={() => { setEncounterQueued(true); setActiveTab("timeline"); void load(); }} />}
      {action === "medication" && <AddMedicationModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "discharge" && <DischargeRecordingModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {action === "handover" && <HandoverRecordingModal patientId={patient.id} onClose={() => setAction(null)} onDone={() => void load()} />}
      {assigningHandover && <AssignHandoverModal patientId={patient.id} handoverId={assigningHandover} onClose={() => setAssigningHandover(null)} onDone={() => void load()} />}
      {action === "edit-patient" && <EditPatientModal patient={patient} onClose={() => setAction(null)} onDone={() => void load()} />}
    </div>
  );
}
