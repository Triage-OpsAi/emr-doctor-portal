export type Workspace = {
  organization: {
    id: string;
    name: string;
    code: string;
    email: string;
    gst_number: string | null;
    contact_name: string;
    contact_email: string;
    contact_mobile: string | null;
    hq_location: string | null;
    is_network_hospital: boolean;
    parent_name: string | null;
  };
  current_user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    permissions: string[];
  };
  workspace_slug: string;
  encrypted_client_id: string;
  workspace_path: string;
};

export type DoctorRecord = {
  id: string;
  encounter_id: string;
  patient_name: string;
  patient_id: string;
  patient_reference: string;
  serial_number: number;
  age: number | null;
  subject: string;
  doctor_name: string;
  nurses: string[];
  status: string;
  created_at: string;
};

export type PatientDashboardRecord = {
  id: string;
  latest_record_id: string | null;
  encounter_id: string | null;
  encounter_number: string | null;
  ward_number: string | null;
  bed_number: string | null;
  patient_name: string;
  patient_reference: string;
  serial_number: number;
  age: number | null;
  gender: string | null;
  phone: string | null;
  subject: string;
  doctor_name: string | null;
  nurses: string[];
  status: string;
  created_at: string;
  last_visit_at: string | null;
  approval_percentage?: number;
};

export type StructuredNote = {
  chief_complaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: string[];
  symptoms: string[];
  medications: { name: string; dosage: string; frequency: string }[];
};

export type RecordDetail = {
  id: string;
  encounter_id: string;
  source_language: string;
  raw_transcript: string | null;
  translated_text: string | null;
  structured_note: StructuredNote | null;
  suggested_codes: {
    system: string;
    code: string;
    display_term: string;
    confidence_score: number;
  }[];
  status: string;
};

export type VoiceIntakeResult = {
  emr_record_id: string;
  encounter_id: string;
  patient: {
    id: string;
    full_name: string;
    patient_reference: string;
    age: number | null;
    gender: string | null;
    phone: string | null;
    created: boolean;
  };
  raw_transcript: string;
  translated_text: string;
  status: "pending_review";
  message: string;
};

export type VoiceJobUpload = {
  job_id: string;
  upload_url: string;
  object_key: string;
  content_type: string;
  expires_in: number;
};

export type VoiceJob = {
  id: string;
  status: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_reference: string | null;
  patient_age: number | null;
  emr_record_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type PatientChartRecord = {
  id: string;
  encounter_id: string;
  department: string | null;
  status: string;
  source_language: string;
  structured_note: StructuredNote | null;
  encounter_summary: string;
  captured_by: string;
  audio_available: boolean;
  created_at: string;
};

export type PatientReport = {
  id: string;
  title: string;
  content_type: string;
  capture_source: "file" | "camera";
  status: string;
  document_type: string | null;
  summary: string | null;
  key_findings: string[];
  extracted_details: Record<string, string> | null;
  quality_message: string | null;
  created_at: string;
};

export type PatientMedication = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
};

export type PatientChart = {
  records: PatientChartRecord[];
  reports: PatientReport[];
  medications: PatientMedication[];
  discharge_summaries: DischargeSummary[];
  handovers: HandoverSummary[];
  section_reviews: PatientSectionReview[];
  approval_percentage: number;
};

export type PatientSectionReview = {
  section_key: "summary" | "timeline" | "clinical" | "medications" | "diagnoses" | "reports" | "documents" | "handover";
  content_override: string | null;
  item_overrides: Record<string, string>;
  deleted_items: string[];
  is_deleted: boolean;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  updated_by: string;
  updated_at: string;
};

export type ReportUpload = {
  report_id: string;
  upload_url: string;
  content_type: string;
  expires_in: number;
};

export type DischargeSummary = {
  id: string;
  status: string;
  source_language: string;
  translated_instructions: string | null;
  summary_data: Record<string, unknown> | null;
  audio_available: boolean;
  pdf_available: boolean;
  error_message: string | null;
  created_at: string;
};

export type DischargeUpload = {
  job_id: string;
  upload_url: string;
  content_type: string;
  expires_in: number;
};

export type HandoverSummary = {
  id: string;
  status: string;
  source_language: string;
  translated_instructions: string | null;
  summary_data: Record<string, unknown> | null;
  captured_by: string;
  handed_over_to: string | null;
  recorded_at: string;
  audio_available: boolean;
  error_message: string | null;
};

export type HandoverUpload = {
  job_id: string;
  upload_url: string;
  content_type: string;
  expires_in: number;
};

export type ClinicalRole = {
  id: string;
  name: string;
  permissions: string[];
};

export type ClinicalUser = {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  is_current_user: boolean;
};

export type ClinicalInvitation = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

export type NetworkHospital = {
  id: string;
  name: string;
  code: string;
  place: string;
  email: string;
  contact_name: string;
  contact_email: string;
  created_at: string;
  is_active: boolean;
  workspace_path: string;
};

export type AuditEvent = {
  id: string;
  client_event_id: string | null;
  action: string;
  event_category: string;
  actor_name: string;
  actor_role: string | null;
  patient_id: string | null;
  patient_name: string | null;
  patient_reference: string | null;
  encounter_id: string | null;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
  source: string;
  changes: Record<string, unknown> | null;
  event_metadata: Record<string, unknown> | null;
  occurred_at: string;
  recorded_at: string;
};

export type AuditEventList = {
  events: AuditEvent[];
  total: number;
};

export type WardVoiceTask = {
  id: string; bed_id: string; bed_number: string; patient_id: string;
  patient_name: string; patient_age: number | null; protocol: string | null;
  doctor_name: string | null; title: string; task_type: string; status: string;
  due_at: string; completed_at: string | null;
};

export type WardVoiceWard = {
  id: string;
  name: string;
  code: string;
  patient_count: number;
};

export type WardVoiceBed = {
  id: string; bed_number: string; patient_id: string | null; patient_name: string | null;
  patient_age: number | null; protocol: string | null; nurse_name: string | null;
  last_entry_at: string | null; next_due_at: string | null; fluid_balance_ml: number;
  completed_tasks: number; total_tasks: number; status: string;
};

export type WardVoiceOverview = {
  ward_id: string | null; ward_name: string | null; ward_code: string | null;
  kpis: { due_next_hour: number; overdue: number; done_this_shift: number; on_time_percentage: number };
  tasks: WardVoiceTask[];
  beds: WardVoiceBed[];
  handover: { bed_id: string; bed_number: string; patient_name: string; text: string; priority: string }[];
  compliance: { on_time_percentage: number; closed_by_08_percentage: number; iv_checks_percentage: number; arithmetic_errors: number };
  audit: { id: string; action: string; resource_type: string; patient_id: string | null; user_name: string; details: Record<string, unknown> | null; created_at: string }[];
  pending_countersigns: number;
};

export type WardVoiceObservation = {
  observation_type: string; value_numeric: number | null; value_text: string | null;
  unit: string | null; confidence: number | null; requires_countersign: boolean;
};

export type WardVoiceCaptureResult = {
  capture_id: string; status: string; raw_transcript: string | null;
  translated_text: string | null; observations: WardVoiceObservation[]; error_message: string | null;
};

export type FluidChart = {
  bed_id: string; bed_number: string; patient_id: string; patient_name: string;
  patient_age: number | null; protocol: string | null; chart_date: string;
  intake_ml: number; output_ml: number; iv_running_ml: number; balance_ml: number;
  entries: { id: string; occurred_at: string; direction: string; category: string; amount_ml: number; source: string; notes: string | null; recorded_by: string }[];
  infusions: { id: string; fluid_name: string; rate_ml_per_hour: number; started_at: string; stopped_at: string | null; calculated_ml: number }[];
  is_closed: boolean; closed_at: string | null;
};

export type WardCountersign = {
  id: string; capture_id: string; bed_number: string; patient_name: string;
  observation_type: string; value_numeric: number | null; value_text: string | null;
  unit: string | null; confirmed_by: string; confirmed_at: string;
};

export type WardConsumable = {
  id: string;
  capture_id: string;
  patient_id: string;
  patient_name: string;
  bed_number: string;
  item_name: string;
  quantity_numeric: number | null;
  quantity_text: string | null;
  unit: string | null;
  recorded_by: string;
  recorded_at: string;
  approval_status: "pending" | "approved";
  approved_by: string | null;
  approved_at: string | null;
};
