import { API_URL } from "@/lib/api";

const AUDIT_QUEUE_KEY = "meridian_audit_outbox_v1";
const ACCESS_KEY = "meridian_doctor_access_token";
const MAX_QUEUED_EVENTS = 1000;

export const AUDIT_EVENTS = {
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  AUDIO_CAPTURE_STARTED: "audio.capture_started",
  AUDIO_CAPTURE_STOPPED: "audio.capture_stopped",
  TRANSCRIPT_GENERATED: "transcript.generated",
  LANGUAGE_DETECTED: "language.detected",
  LANGUAGE_SELECTED: "language.selected",
  CLINICAL_EXTRACTION_CREATED: "clinical_extraction.created",
  USER_CONFIRMATION_OR_CORRECTION: "user.confirmation_or_correction",
  NOTE_DRAFT_CREATED: "note.draft_created",
  NOTE_APPROVED_SIGNED: "note.approved_signed",
  EMR_SYNC_ATTEMPTED: "emr_sync.attempted",
  EMR_SYNC_SUCCESS: "emr_sync.success",
  EMR_SYNC_FAILURE: "emr_sync.failure",
} as const;

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  [AUDIT_EVENTS.USER_LOGIN]: "User login",
  [AUDIT_EVENTS.USER_LOGOUT]: "User logout",
  [AUDIT_EVENTS.AUDIO_CAPTURE_STARTED]: "Audio capture started",
  [AUDIT_EVENTS.AUDIO_CAPTURE_STOPPED]: "Audio capture stopped",
  [AUDIT_EVENTS.TRANSCRIPT_GENERATED]: "Transcript generated",
  [AUDIT_EVENTS.LANGUAGE_DETECTED]: "Language detected",
  [AUDIT_EVENTS.LANGUAGE_SELECTED]: "Language selected",
  [AUDIT_EVENTS.CLINICAL_EXTRACTION_CREATED]: "Clinical extraction created",
  [AUDIT_EVENTS.USER_CONFIRMATION_OR_CORRECTION]: "User confirmation or correction",
  [AUDIT_EVENTS.NOTE_DRAFT_CREATED]: "Note draft created",
  [AUDIT_EVENTS.NOTE_APPROVED_SIGNED]: "Note approved / signed",
  [AUDIT_EVENTS.EMR_SYNC_ATTEMPTED]: "EMR sync attempted",
  [AUDIT_EVENTS.EMR_SYNC_SUCCESS]: "EMR sync success",
  [AUDIT_EVENTS.EMR_SYNC_FAILURE]: "EMR sync failure",
};

export const REQUIRED_AUDIT_EVENT_IDS = Object.values(AUDIT_EVENTS);

export type AuditEventInput = {
  action: string;
  event_category?: string;
  resource_type?: string;
  resource_id?: string | null;
  patient_id?: string | null;
  encounter_id?: string | null;
  outcome?: "success" | "failure" | "denied" | "queued";
  source?: string;
  request_id?: string | null;
  changes?: Record<string, unknown> | null;
  event_metadata?: Record<string, unknown> | null;
};

type QueuedAuditEvent = AuditEventInput & {
  client_event_id: string;
  occurred_at: string;
};

let flushing = false;

function readQueue(): QueuedAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(AUDIT_QUEUE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedAuditEvent[]) {
  localStorage.setItem(AUDIT_QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUED_EVENTS)));
}

export function queueAuditEvent(input: AuditEventInput) {
  if (typeof window === "undefined") return;
  const queue = readQueue();
  queue.push({
    client_event_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    event_category: "clinical",
    resource_type: "system",
    outcome: "success",
    source: "web",
    ...input,
  });
  writeQueue(queue);
  void flushAuditQueue();
}

export async function flushAuditQueue() {
  if (typeof window === "undefined" || flushing || !navigator.onLine) return;
  const token = localStorage.getItem(ACCESS_KEY);
  if (!token) return;
  flushing = true;
  try {
    const queue = readQueue();
    let delivered = 0;
    for (const event of queue) {
      try {
        const response = await fetch(`${API_URL}/audit/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });
        if (!response.ok) break;
        delivered += 1;
      } catch {
        break;
      }
    }
    if (delivered) writeQueue(queue.slice(delivered));
  } finally {
    flushing = false;
  }
}

export function startAuditRetryService() {
  if (typeof window === "undefined") return () => undefined;
  const retry = () => void flushAuditQueue();
  window.addEventListener("online", retry);
  const interval = window.setInterval(retry, 15_000);
  retry();
  return () => {
    window.removeEventListener("online", retry);
    window.clearInterval(interval);
  };
}
