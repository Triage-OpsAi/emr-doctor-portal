"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";

const navigation = [
  ["Product", "#product"],
  ["How it works", "#workflow"],
  ["Features", "#features"],
  ["Security", "#security"],
] as const;

const capabilities: Array<{ icon: IconName; title: string; copy: string }> = [
  {
    icon: "mic",
    title: "Voice patient intake",
    copy: "Capture consultations and turn recordings into structured records ready for clinical review.",
  },
  {
    icon: "file",
    title: "Longitudinal patient charts",
    copy: "Review notes, medications, reports, encounters and care history in one clear patient view.",
  },
  {
    icon: "users",
    title: "Clinical handovers",
    copy: "Prepare and assign patient handovers so the next clinician receives a focused care update.",
  },
  {
    icon: "shield",
    title: "Controlled access",
    copy: "Tenant-scoped workspaces, role permissions and an audit trail support accountable access.",
  },
];

const workflow = [
  ["01", "Capture", "Record a patient intake or add an existing clinical document."],
  ["02", "Structure", "The platform prepares a structured clinical record for review."],
  ["03", "Review", "Clinicians verify the note, chart context and supporting information."],
  ["04", "Coordinate", "Continue care with records, reports, discharge summaries or handovers."],
] as const;

function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--teal)] text-lg font-bold text-[#07110f] shadow-[0_8px_24px_rgba(43,175,158,.22)]">
        +
      </span>
      <span>
        <span className="block font-display text-[15px] font-semibold leading-none">Meridian Health AI</span>
        <span className="mt-1 block font-mono text-[8px] uppercase tracking-[.18em] text-[var(--faint)]">Clinical workspace</span>
      </span>
    </span>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle,rgba(43,175,158,.18),transparent_68%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--ink-elevated)] shadow-[0_30px_90px_var(--shadow)]">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--teal)] text-[11px] font-bold text-[#07110f]">+</span>
            <span className="text-[10px] font-semibold">Clinical workspace</span>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-[var(--faint)]/40" />
            <span className="h-2 w-2 rounded-full bg-[var(--faint)]/40" />
            <span className="h-2 w-2 rounded-full bg-[var(--teal)]" />
          </div>
        </div>
        <div className="grid min-h-[360px] grid-cols-[70px_1fr] sm:grid-cols-[148px_1fr]">
          <aside className="border-r p-3">
            <div className="mb-6 h-8 rounded-lg bg-[var(--teal-soft)]" />
            {["Home", "Patients", "EHR", "Audit"].map((item, index) => (
              <div key={item} className={`mb-2 flex h-8 items-center gap-2 rounded-lg px-2 ${index === 0 ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "text-[var(--faint)]"}`}>
                <span className={`h-2 w-2 rounded-full ${index === 0 ? "bg-[var(--teal)]" : "bg-[var(--border)]"}`} />
                <span className="hidden text-[9px] sm:block">{item}</span>
              </div>
            ))}
          </aside>
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[.15em] text-[var(--teal)]">Patient operations</p>
                <p className="mt-1 font-display text-lg font-semibold">Good day, Dr. Mehta</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--teal)] text-[var(--ink-elevated)]"><Icon name="mic" size={15} /></span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[["24", "Patients"], ["18", "Reviewed"], ["06", "Pending"]].map(([value, label]) => (
                <div key={label} className="rounded-xl border bg-[var(--ink)] p-3">
                  <p className="font-display text-lg">{value}</p>
                  <p className="mt-1 text-[8px] text-[var(--faint)]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border bg-[var(--ink)]">
              <div className="flex items-center justify-between border-b p-3">
                <p className="text-[10px] font-semibold">Patient records</p>
                <span className="h-6 w-20 rounded-md border" />
              </div>
              {[
                ["Anaya Rao", "MH-1042", "Reviewed"],
                ["Rohan Shah", "MH-1041", "Pending"],
                ["Mira Nair", "MH-1040", "Reviewed"],
              ].map(([name, id, status]) => (
                <div key={id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b p-3 last:border-0">
                  <div>
                    <p className="text-[9px] font-medium">{name}</p>
                    <p className="mt-1 font-mono text-[7px] text-[var(--faint)]">{id}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[7px] ${status === "Reviewed" ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-amber-500/10 text-amber-500"}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border bg-[var(--ink-elevated)] px-4 py-3 shadow-xl sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="shield" size={16} /></span>
        <span><span className="block text-[10px] font-semibold">Review stays human</span><span className="mt-0.5 block text-[8px] text-[var(--faint)]">Structured for clinical verification</span></span>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--ink)] text-[var(--text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)]/80 bg-[var(--ink)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link href="/" aria-label="Meridian Health AI home"><Brand /></Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {navigation.map(([label, href]) => <a key={href} href={href} className="focus-ring rounded text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]">{label}</a>)}
            <Link href="/login" className="focus-ring rounded text-xs font-semibold text-[var(--text)]">Login</Link>
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <ThemeToggle />
            <Link href="/login" className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--teal)] px-5 text-xs font-semibold text-[#07110f] transition hover:-translate-y-0.5 hover:brightness-105">
              Access platform <Icon name="chevron" size={14} />
            </Link>
          </div>
          <div className="flex items-center gap-3 lg:hidden">
            <ThemeToggle />
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="focus-ring grid h-10 w-10 place-items-center rounded-xl border bg-[var(--ink-elevated)]" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? "Close navigation" : "Open navigation"}>
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" className="border-t bg-[var(--ink-elevated)] px-5 py-5 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navigation.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)} className="focus-ring rounded-xl px-4 py-3 text-sm text-[var(--muted)] hover:bg-[var(--teal-soft)] hover:text-[var(--text)]">{label}</a>)}
              <Link href="/login" className="focus-ring mt-2 flex h-12 items-center justify-center rounded-xl bg-[var(--teal)] text-sm font-semibold text-[#07110f]">Login to your workspace</Link>
            </div>
          </nav>
        )}
      </header>

      <section className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-16 px-5 pb-24 pt-36 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:px-10 lg:pt-32">
        <div className="pointer-events-none absolute left-[-16rem] top-20 h-[34rem] w-[34rem] rounded-full bg-[var(--teal)]/10 blur-[120px]" />
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-[var(--ink-elevated)] px-3 py-2 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--teal)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)] shadow-[0_0_0_4px_var(--teal-soft)]" />
            Built for focused clinical work
          </span>
          <h1 className="mt-7 font-display text-[clamp(3rem,7vw,5.9rem)] leading-[.98] tracking-[-.045em]">
            Patient context,<br /><span className="text-[var(--teal)]">ready for care.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
            Meridian brings voice intake, structured clinical records, reports and care coordination into one secure workspace for hospital teams.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="focus-ring inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[var(--teal)] px-6 py-4 text-sm font-semibold text-[#07110f] transition hover:-translate-y-0.5 hover:brightness-105">
              Sign in securely <Icon name="chevron" size={15} />
            </Link>
            <a href="#product" className="focus-ring inline-flex h-13 items-center justify-center gap-2 rounded-xl border bg-[var(--ink-elevated)] px-6 py-4 text-sm font-semibold transition hover:border-[var(--teal)]/50">
              See the clinical workflow <Icon name="activity" size={15} />
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-[var(--faint)]">
            {["Role-aware access", "Auditable activity", "Human clinical review"].map((item) => <span key={item} className="flex items-center gap-2"><Icon name="shield" size={13} className="text-[var(--teal)]" />{item}</span>)}
          </div>
        </div>
        <div className="relative z-10"><DashboardPreview /></div>
      </section>

      <section className="border-y bg-[var(--ink-elevated)]">
        <div className="mx-auto grid max-w-7xl divide-y px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4 lg:px-10">
          {["Voice to structured record", "One longitudinal patient view", "Clear care handovers", "Accountable workspace access"].map((item, index) => (
            <div key={item} className="flex min-h-28 items-center gap-4 px-3 py-6 sm:px-6">
              <span className="font-mono text-[10px] text-[var(--teal)]">0{index + 1}</span>
              <p className="max-w-[170px] text-sm font-medium leading-5">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="product" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-10 lg:py-36">
        <div className="grid gap-16 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-32">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--teal)]">One clinical workspace</p>
            <h2 className="mt-5 max-w-md font-display text-4xl leading-tight tracking-tight sm:text-5xl">A clearer path from intake to follow-up.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[var(--muted)]">Information stays connected to the patient chart, giving clinicians a more complete view before the next action.</p>
          </div>
          <div id="workflow" className="scroll-mt-24 grid gap-4 sm:grid-cols-2">
            {workflow.map(([number, title, copy]) => (
              <article key={number} className="group min-h-56 rounded-2xl border bg-[var(--ink-elevated)] p-6 transition hover:-translate-y-1 hover:border-[var(--teal)]/40">
                <div className="flex items-center justify-between"><span className="font-mono text-[10px] text-[var(--teal)]">{number}</span><span className="h-px w-12 bg-[var(--border)] transition-all group-hover:w-20 group-hover:bg-[var(--teal)]" /></div>
                <h3 className="mt-12 font-display text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y bg-[var(--ink-elevated)]">
        <div className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--teal)]">Purpose-built tools</p>
            <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">Less searching. More clinical continuity.</h2>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.title} className="group rounded-2xl border bg-[var(--ink)] p-6 transition hover:-translate-y-1 hover:border-[var(--teal)]/40">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--teal-soft)] text-[var(--teal)] transition group-hover:bg-[var(--teal)] group-hover:text-[#07110f]"><Icon name={item.icon} size={20} /></span>
                <h3 className="mt-8 text-sm font-semibold">{item.title}</h3>
                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-10">
        <div className="overflow-hidden rounded-[32px] border bg-[var(--ink-elevated)]">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="p-8 sm:p-12 lg:p-16">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name="shield" size={23} /></span>
              <p className="mt-9 font-mono text-[10px] uppercase tracking-[.2em] text-[var(--teal)]">Security and accountability</p>
              <h2 className="mt-5 max-w-xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">Clinical access with clear boundaries.</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Meridian uses authenticated, tenant-scoped workspaces with role permissions, private file access and recorded audit activity.</p>
            </div>
            <div className="grid border-t lg:border-l lg:border-t-0">
              {[
                ["Tenant-scoped workspaces", "Hospital records remain within the active organisation context."],
                ["Role-aware navigation", "Available workspace actions reflect the signed-in user’s permissions."],
                ["Audit trail", "Important authentication and clinical activity can be reviewed."],
              ].map(([title, copy], index) => (
                <div key={title} className="flex gap-5 border-b p-7 last:border-0 sm:p-9">
                  <span className="font-mono text-[10px] text-[var(--teal)]">0{index + 1}</span>
                  <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{copy}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-28 sm:px-8 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-[var(--teal)] px-7 py-16 text-[#07110f] sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-[#07110f]/10" />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-70">Your clinical workspace</p>
            <h2 className="mt-4 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Ready when the care team is.</h2>
            <p className="mt-4 text-sm leading-6 opacity-75">Use your work email, password and hospital code to access Meridian securely.</p>
          </div>
          <Link href="/login" className="focus-ring relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-[#07110f] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 lg:mt-0">
            Continue to login <Icon name="chevron" size={15} />
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Brand />
          <div className="flex flex-wrap gap-5 text-xs text-[var(--muted)]">
            {navigation.map(([label, href]) => <a key={href} href={href} className="focus-ring rounded hover:text-[var(--text)]">{label}</a>)}
            <Link href="/login" className="focus-ring rounded font-semibold text-[var(--text)]">Login</Link>
          </div>
          <p className="font-mono text-[9px] text-[var(--faint)]">© 2026 Meridian Health AI</p>
        </div>
      </footer>
    </main>
  );
}
