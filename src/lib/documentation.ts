import { apiFetch } from "./api";
import type { Signature } from "@/components/SignaturePad";
export type DocumentationTemplate = {
    id: string;
    specialty: string;
    title: string;
    encounter_type: string;
    stage: string;
    destination: string;
    version: string;
    fields: {
        key: string;
        label: string;
        required: boolean;
    }[];
};
export type DocumentField = {
    value: string;
    source: "dictation" | "clinician_entered";
    evidence: string;
};
export type DocumentContext = {
    patient: {
        id: string;
        name: string;
        reference: string;
        date_of_birth: string | null;
        gender: string | null;
    };
    encounters: {
        id: string;
        visit_id: string | null;
        reference: string;
        department: string | null;
        clinician: string;
        date: string;
        specialty: string;
    }[];
};
export type ClinicalDocument = {
    id: string;
    patient_id: string;
    encounter_id: string;
    template: DocumentationTemplate;
    context: DocumentContext["patient"] & {
        encounter: DocumentContext["encounters"][number];
    };
    transcript: string;
    original_transcript: string;
    fields: Record<string, DocumentField>;
    mode: "structured" | "narrative";
    status: string;
    revision: number;
    checks: {
        key: string;
        message: string;
    }[];
    reviewed_checks: Record<string, string>;
    signature: Signature | null;
    signer_name: string | null;
    signed_at: string | null;
    signed_digest: string | null;
    destination: string;
    created_at: string;
    updated_at: string;
};
const root = "/ward-voice/documentation";
export const documentationService = {
    suggest: (patient_id: string, encounter_id: string, transcript: string) => apiFetch<{
        template_id: string;
        specialty: string;
        reason: string;
    }>(`${root}/suggest`, { method: "POST", body: JSON.stringify({ patient_id, encounter_id, transcript }) }),
    templates: () => apiFetch<DocumentationTemplate[]>(`${root}/templates`),
    context: (patient: string) => apiFetch<DocumentContext>(`${root}/patients/${patient}/context`),
    list: (patient: string) => apiFetch<ClinicalDocument[]>(`${root}/patients/${patient}`),
    create: (patient_id: string, encounter_id: string, template_id: string, transcript: string, original_transcript: string) => apiFetch<ClinicalDocument>(root, { method: "POST", body: JSON.stringify({ patient_id, encounter_id, template_id, transcript, original_transcript }) }),
    save: (doc: ClinicalDocument, transcript: string, fields: Record<string, string>, mode: string) => apiFetch<ClinicalDocument>(`${root}/${doc.id}`, { method: "PUT", body: JSON.stringify({ revision: doc.revision, transcript, fields, mode }) }),
    generate: (doc: ClinicalDocument) => apiFetch<ClinicalDocument>(`${root}/${doc.id}/generate`, { method: "POST", body: JSON.stringify({ revision: doc.revision }) }),
    review: (doc: ClinicalDocument, acknowledgements: Record<string, string>) => apiFetch<ClinicalDocument>(`${root}/${doc.id}/review`, { method: "POST", body: JSON.stringify({ revision: doc.revision, acknowledgements }) }),
    finalize: (doc: ClinicalDocument, signature: Signature) => apiFetch<ClinicalDocument>(`${root}/${doc.id}/finalize`, { method: "POST", body: JSON.stringify({ revision: doc.revision, signature, confirmed: true }) }),
    transcribe: (patient: string, audio: Blob) => apiFetch<{
        raw_transcript: string;
        translated_text: string;
    }>(`${root}/patients/${patient}/transcribe`, { method: "POST", headers: { "Content-Type": audio.type.split(";")[0] }, body: audio }),
};
export const destinationLabels: Record<string, string> = { clinical: "Clinical documentation", reports: "Radiology reports", documents: "Discharge summaries" };
