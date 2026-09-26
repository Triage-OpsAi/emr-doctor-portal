import type { Signature } from "@/components/SignaturePad";

export type Language = "en" | "hi";
export type Choice = "accepted" | "declined" | null;
export type Entry = { text: string; ink: Signature | null };
export type Field = "patient_name" | "age" | "gender" | "mobile" | "address" | "procedure" | "purpose" | "representative_name" | "patient_date" | "clinician_name" | "registration" | "clinician_date" | "witness_name" | "witness_date";
export type Wording = {
  title: string; subtitle: string; sections: string[]; labels: Record<string, string>;
  data_intro: string; data_includes: string; data_items: string[]; data_sharing: string; data_access: string; data_yes: string; data_no: string;
  procedure_intro: string; questions: string; understand: string; procedure_items: string[]; procedure_yes: string; procedure_no: string;
  patient_declaration: string; clinician_declaration: string; demo_title: string; demo_notice: string; policy_title?: string; policy_notice?: string;
  write: string; type: string; clear: string; ink_hint: string; blank: string; signature_hint: string; audio_hint: string; choose: string; save: string; saved: string; confirmation: string; witness_optional: string;
};
export type Template = { version: "demo-consent-v1" | "hospital-consent-v2"; en: Wording; hi: Wording };
export type Context = { template: Template; hospital_name: string; patient_reference: string; patient_name: string; date: string; prefill?: Partial<Record<Field, Entry>> };
export type DemoForm = Context & {
  fields: Partial<Record<Field, Entry>>; language: Language;
  data_decision: Choice; procedure_decision: Choice;
  patient_signature: Signature | null; clinician_signature: Signature | null; witness_signature: Signature | null;
};
export function hasEntry(entry?: Entry) { return !!(entry?.text.trim() || entry?.ink); }
export function consentAudio(form: DemoForm, language: Language): string {
  const t = form.template[language];
  const field = (key: Field) => form.fields[key]?.text ? `${t.labels[key]}. ${form.fields[key]!.text}` : "";
  return [t.title, t.subtitle, t.policy_notice, t.labels.hospital, form.hospital_name,
    t.sections[0], ...(["patient_name", "age", "gender", "mobile", "address"] as Field[]).map(field),
    t.sections[1], t.data_intro, t.data_includes, ...t.data_items, t.data_sharing, t.data_access, t.data_yes, t.data_no,
    form.data_decision ? `${t.saved}: ${form.data_decision === "accepted" ? t.data_yes : t.data_no}` : t.choose,
    t.sections[2], t.procedure_intro, field("procedure"), field("purpose"), t.questions, t.understand, ...t.procedure_items,
    t.procedure_yes, t.procedure_no, form.procedure_decision ? `${t.saved}: ${form.procedure_decision === "accepted" ? t.procedure_yes : t.procedure_no}` : t.choose,
    t.sections[3], t.patient_declaration, field("representative_name"), t.sections[4], t.clinician_declaration,
    field("clinician_name"), field("registration"), t.sections[5], field("witness_name")].filter(Boolean).join("\n\n");
}
