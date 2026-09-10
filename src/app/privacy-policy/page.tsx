import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";
import { TriCareLogo } from "@/components/TriCareLogo";

export const metadata: Metadata = {
  title: "Privacy Policy | Tri-Care",
  description: "Learn how information is handled in the Tri-Care clinical workspace, including patient records, voice intake, and your privacy choices.",
};

const sections = [
  {
    id: "scope",
    title: "Who this policy is for",
    paragraphs: [
      "Tri-Care helps healthcare teams capture consultations, review patient records, and coordinate care. This policy explains information handling across our website and doctor portal for visitors, healthcare professionals, and people whose information is entered into a workspace.",
      "Your hospital or healthcare organisation manages your care records and decides how its workspace is used. Read this policy alongside your healthcare provider's privacy notice, which explains its purposes for processing, legal basis, recordkeeping obligations, and contact details.",
    ],
  },
  {
    id: "information",
    title: "Information handled by the portal",
    paragraphs: [
      "Account and workspace information includes work email addresses, hospital identifiers, account credentials, user roles, and organisation contact details used to provide access to the appropriate workspace.",
      "Clinical information may include patient identifiers and contact details, medical history, symptoms, medications, consultation notes, uploaded reports, discharge summaries, and handover information supplied by authorised users.",
      "When voice intake is used, the portal handles audio recordings, transcripts, selected or detected languages, and the clinical notes generated from that content. Activity records may include sign-ins, record actions, timestamps, resource identifiers, and processing outcomes used for audit and troubleshooting.",
    ],
  },
  {
    id: "purposes",
    title: "How information is used",
    paragraphs: [
      "Information is used to authenticate users, connect them to their hospital workspace, display patient histories, prepare clinical documentation, and support care coordination. It also supports session management, troubleshooting, and reviews of important account and clinical activity.",
      "Healthcare professionals should enter only information relevant to their work and access records only when authorised. The healthcare organisation is responsible for identifying the applicable basis for processing patient information and providing any required notices or obtaining consent.",
    ],
  },
  {
    id: "voice-and-ai",
    title: "Voice recordings and AI-assisted documentation",
    paragraphs: [
      "Voice features require microphone permission in your browser. Recordings and submitted documents may be processed by the services configured for your workspace to produce transcripts, extract clinical details, and prepare draft notes. Clinicians should review generated content for accuracy before using it in a patient record or care decision.",
      "Before recording, explain the purpose to the people involved and obtain any permission required by your organisation and applicable law. You can stop a recording or revoke microphone permission through your browser settings; revoking permission does not delete information already submitted.",
      "Ask your healthcare organisation for the AI and transcription providers used in its deployment, their processing locations, retention terms, and whether any separate model-training use is permitted under its agreements. These details depend on the services configured for that workspace.",
    ],
  },
  {
    id: "sharing",
    title: "Access and sharing",
    paragraphs: [
      "Access within a workspace depends on account permissions and the healthcare organisation's configuration. Clinical information may be shared with authorised care teams through handovers, reports, exports, or connected record systems when those functions are used.",
      "Operating the service may involve hosting, storage, support, and clinical processing providers. The specific recipients, any processing outside your country, and the safeguards that apply are governed by the organisation's deployment and service agreements. Contact your organisation for these details and for information about disclosures required by applicable law.",
    ],
  },
  {
    id: "browser-storage",
    title: "Cookies and browser storage",
    paragraphs: [
      "The portal uses session cookies and browser storage to support sign-in and session security. Local storage also remembers your theme preference and can temporarily queue audit events for delivery. Session storage can hold a session-expiry message.",
      "You can manage cookies and clear stored site data in your browser. Blocking or removing storage may sign you out, reset preferences, or interfere with portal features. Clearing your browser does not remove patient records already stored by your healthcare organisation.",
    ],
  },
  {
    id: "security-retention",
    title: "Security and retention",
    paragraphs: [
      "The portal includes workspace-scoped access, session controls, and audit logging to support accountable use. Protect your credentials, sign out on shared devices, and report suspected unauthorised access to your workspace administrator promptly. No online service can guarantee complete security.",
      "Retention depends on the type of information, your organisation's clinical recordkeeping requirements, service agreements, and applicable law. Patient records, audio, transcripts, backups, and audit records may have different retention periods. Ask your organisation for its schedule and deletion process; closing an account does not necessarily erase records that must be retained.",
    ],
  },
  {
    id: "choices",
    title: "Your choices and privacy requests",
    paragraphs: [
      "Depending on applicable law and the circumstances, you may be able to request access to your information, correction of inaccurate details, a copy of your records, deletion, or restrictions on particular uses. Where processing relies on consent, you may be able to withdraw it. Some requests may be limited by clinical recordkeeping requirements or other obligations.",
      "Contact the hospital or healthcare provider responsible for your records to make a request. It may need to verify your identity and authority before responding. For a child's records, a parent, guardian, or other authorised representative should contact the care provider, subject to applicable rules.",
    ],
  },
  {
    id: "contact",
    title: "Questions, concerns, and updates",
    paragraphs: [
      "For patient record questions or privacy concerns, contact your healthcare provider through its published contact details and ask for the privacy officer or records team. Workspace users can also contact their hospital administrator using the organisation contact information available in workspace settings. Avoid sending medical records or passwords through an unsecured message.",
      "If a concern remains unresolved, you may be able to contact the relevant data protection authority in your jurisdiction. This policy may be updated as the portal evolves; the date at the top identifies the latest revision. Your healthcare organisation's notice remains the source for its specific data handling arrangements.",
    ],
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--text)]">
      <header className="border-b bg-[var(--ink-elevated)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="Tri-Care home" className="focus-ring flex items-center gap-3 rounded-lg">
            <TriCareLogo size={38} />
            <span className="text-base font-black uppercase tracking-wide">Tri-Care</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-5 text-xs sm:gap-7">
            <Link href="/" className="focus-ring rounded text-[var(--muted)] hover:text-[var(--text)]">Home</Link>
            <Link href="/privacy-policy" aria-current="page" className="focus-ring rounded font-semibold text-[var(--teal)]">Privacy Policy</Link>
            <Link href="/login" className="focus-ring rounded font-semibold">Login</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="shield" size={24} /></span>
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--teal)]">Privacy at Tri-Care</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">Privacy Policy</h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">Care starts with trust. Here is how information supports your clinical workspace, and how to get answers about your privacy.</p>
          <p className="mt-6 text-xs text-[var(--faint)]">Last updated: <time dateTime="2026-09-10">10 September 2026</time></p>
        </div>

        <div className="mt-12 grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
          <aside className="rounded-2xl border bg-[var(--ink-elevated)] p-6 lg:sticky lg:top-8">
            <h2 className="text-sm font-semibold">In this policy</h2>
            <nav aria-label="Policy contents" className="mt-4 flex flex-col gap-3">
              {sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="focus-ring rounded text-xs leading-5 text-[var(--muted)] hover:text-[var(--teal)]">{String(index + 1).padStart(2, "0")}. {section.title}</a>)}
            </nav>
          </aside>
          <article className="min-w-0 rounded-3xl border bg-[var(--ink-elevated)] px-6 sm:px-10">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-8 border-b py-8 last:border-0 sm:py-10">
                <p className="mb-3 font-mono text-[10px] text-[var(--teal)]">{String(index + 1).padStart(2, "0")}</p>
                <h2 id={`${section.id}-heading`} className="text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-sm leading-7 text-[var(--muted)]">{paragraph}</p>)}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 text-xs text-[var(--muted)] sm:px-8">
          <p>&copy; 2026 Tri-Care</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6">
            <Link href="/" className="focus-ring rounded hover:text-[var(--text)]">Home</Link>
            <Link href="/privacy-policy" aria-current="page" className="focus-ring rounded text-[var(--teal)]">Privacy Policy</Link>
            <Link href="/login" className="focus-ring rounded hover:text-[var(--text)]">Open workspace</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
