"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";
import { TriCareLogo } from "@/components/TriCareLogo";

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
      <TriCareLogo size={38} className="shadow-[0_8px_24px_rgba(43,175,158,.22)]" />
      <span>
        <span className="block text-[16px] font-black uppercase leading-none tracking-[.04em]">Tri-Care</span>
        <span className="mt-1 block font-mono text-[8px] uppercase tracking-[.18em] text-[var(--faint)]">Clinical workspace</span>
      </span>
    </span>
  );
}

const waveform = [22, 38, 54, 30, 70, 42, 82, 50, 34, 66, 92, 48, 76, 40, 58, 28, 64, 88, 44, 72, 36, 55, 24, 46, 32, 18];

function VoiceWave({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-[3px] ${compact ? "h-10" : "h-16"}`} aria-hidden="true">
      {waveform.map((height, index) => (
        <span
          key={index}
          className="landing-wave-bar w-[2px] rounded-full bg-[var(--teal)] opacity-80 shadow-[0_0_8px_rgba(43,175,158,.35)]"
          style={{ height: `${compact ? Math.max(5, height * 0.42) : height * 0.58}%`, animationDelay: `${index * -45}ms` }}
        />
      ))}
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto min-h-[520px] w-full max-w-[760px] lg:min-h-[590px]">
      <div className="absolute inset-[8%_4%_2%_0] rounded-full bg-[radial-gradient(circle,rgba(43,175,158,.2),transparent_68%)] blur-3xl" />

      <div className="absolute left-0 top-[5%] w-[88%] rotate-[-3deg] rounded-[24px] border border-[var(--preview-edge)] bg-[var(--preview-shell)] p-[9px] shadow-[0_45px_100px_var(--shadow)] sm:p-[12px]">
        <div className="overflow-hidden rounded-[15px] border border-[var(--preview-border)] bg-[var(--preview-screen)] text-[var(--preview-text)]">
          <div className="grid min-h-[390px] grid-cols-[92px_1fr] sm:min-h-[470px] sm:grid-cols-[138px_1fr]">
            <aside className="border-r border-[var(--preview-border)] p-3 sm:p-4">
              <div className="mb-7 flex items-center gap-2">
                <TriCareLogo size={25} className="rounded-md" />
                <div className="hidden sm:block"><p className="text-[10px] font-bold">Tri-Care</p><p className="font-mono text-[5px] uppercase tracking-[.18em] text-[var(--preview-muted)]">Clinical workspace</p></div>
              </div>
              {([['home', 'Home'], ['users', 'Patients'], ['file', 'EHR'], ['shield', 'Audit']] as Array<[IconName, string]>).map(([icon, item], index) => (
                <div key={item} className={`mb-2 flex h-10 items-center gap-2 rounded-lg px-3 ${index === 0 ? "bg-[var(--preview-teal-soft)] text-[var(--teal)]" : "text-[var(--preview-muted)]"}`}>
                  <Icon name={icon} size={13} />
                  <span className="hidden text-[8px] sm:block">{item}</span>
                </div>
              ))}
            </aside>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-[8px] uppercase tracking-[.15em] text-[var(--teal)]">Voice dictation</p>
                <span className="rounded-lg border border-[var(--preview-border)] px-3 py-2 text-[8px]">◎&nbsp; Hindi⌄</span>
              </div>
              <div className="rounded-xl border border-[var(--preview-border)] bg-[var(--preview-panel)] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold">Listening…</p>
                    <VoiceWave />
                  </div>
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[var(--teal)] bg-[var(--preview-teal-soft)] text-[var(--teal)] shadow-[0_0_24px_rgba(43,175,158,.25)]"><Icon name="mic" size={25} /></span>
                </div>
                <div className="mt-2 border-t border-[var(--preview-border)] pt-3">
                  <div className="flex justify-between gap-2"><p className="text-[8px] font-semibold text-[var(--teal)]">Doctor dictation in Hindi</p><span className="text-[7px] text-[var(--preview-muted)]">00:24</span></div>
                  <p className="mt-2 text-[9px] leading-4">रोगी को हल्का बुखार और सिरदर्द है।<br />पैरासिटामोल 650 मि.ग्रा. SOS दें।</p>
                  <p className="mt-2 flex items-center gap-1 text-[7px] text-[var(--teal)]"><Icon name="shield" size={10} /> Captured securely</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[var(--preview-border)] bg-[var(--preview-panel)] p-4">
                <p className="font-mono text-[7px] uppercase tracking-[.15em] text-[var(--teal)]">Structured patient record</p>
                <div className="mt-3 grid grid-cols-[1fr_72px] gap-3">
                  <div className="overflow-hidden rounded-lg border border-[var(--preview-border)] text-[8px]">
                    {[["Chief Complaint", "हल्का बुखार और सिरदर्द"], ["Assessment", "संभावित वायरल फीवर"], ["Medication", "पैरासिटामोल 650 मि.ग्रा."], ["Advice", "पर्याप्त पानी पिएं"]].map(([label, value]) => <div key={label} className="grid grid-cols-[.8fr_1.2fr] border-b border-[var(--preview-border)] px-2 py-2 last:border-0"><span className="text-[var(--preview-muted)]">{label}</span><span>{value}</span></div>)}
                  </div>
                  <div className="grid place-items-center rounded-lg border border-[var(--preview-border)] text-[var(--preview-muted)]"><Icon name="file" size={28} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-4 left-[8%] h-4 w-[98%] rounded-b-2xl bg-[var(--preview-shell)] shadow-xl" />
      </div>

      <div className="absolute bottom-[2%] right-0 z-20 w-[34%] min-w-[178px] rotate-[2deg] rounded-[30px] border-[5px] border-[var(--preview-shell)] bg-[var(--preview-screen)] p-3 text-[var(--preview-text)] shadow-[0_28px_70px_var(--shadow)] sm:border-[7px] sm:p-4">
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[var(--preview-border)]" />
        <div className="flex items-center gap-2 border-b border-[var(--preview-border)] pb-3"><TriCareLogo size={23} className="rounded-md" /><div><p className="text-[9px] font-bold">Tri-Care</p><p className="font-mono text-[5px] uppercase text-[var(--preview-muted)]">Clinical workspace</p></div></div>
        <p className="mt-3 text-[8px] font-semibold text-[var(--teal)]">Voice dictation</p>
        <p className="mt-1 text-[9px] font-semibold">Listening…</p>
        <VoiceWave compact />
        <div className="rounded-lg border border-[var(--preview-border)] p-2">
          <p className="text-[7px] font-semibold text-[var(--teal)]">Doctor dictation in Hindi</p>
          <p className="mt-2 text-[7px] leading-3">रोगी को हल्का बुखार है।<br />650 मि.ग्रा. SOS दें।</p>
        </div>
        <div className="mt-3 rounded-lg border border-[var(--preview-border)] p-2">
          <p className="font-mono text-[6px] uppercase text-[var(--teal)]">Structured patient record</p>
          <p className="mt-2 text-[7px] text-[var(--preview-muted)]">Chief Complaint</p><p className="text-[7px]">हल्का बुखार और सिरदर्द</p>
        </div>
      </div>

      <div className="absolute bottom-0 right-[22%] z-30 hidden w-36 rounded-xl border border-[var(--preview-border)] bg-[var(--preview-panel)] p-3 text-[8px] text-[var(--preview-text)] shadow-2xl sm:block">
        <p className="mb-2 text-[var(--teal)]">✓ Hindi</p>
        {[["தமிழ்", "Tamil"], ["తెలుగు", "Telugu"], ["ಕನ್ನಡ", "Kannada"], ["मराठी", "Marathi"]].map(([native, label]) => <p key={label} className="flex justify-between py-1"><span>{native}</span><span className="text-[var(--preview-muted)]">{label}</span></p>)}
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--ink)] text-[var(--text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)]/70 bg-[var(--ink)]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Tri-Care home"><Brand /></Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {navigation.map(([label, href]) => <a key={href} href={href} className="focus-ring rounded text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]">{label}</a>)}
            <Link href="/login" className="focus-ring rounded text-xs font-semibold text-[var(--text)]">Login</Link>
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <ThemeToggle />
            <Link href="/login" className="focus-ring inline-flex h-10 items-center gap-2 rounded-full bg-[var(--teal)] px-5 text-xs font-bold text-[#07110f] transition hover:-translate-y-0.5 hover:brightness-105">
              Open workspace <Icon name="chevron" size={14} />
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

      <section className="landing-hero relative mx-auto grid min-h-[820px] max-w-[1500px] items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-12 lg:pb-24 lg:pt-28">
        <div className="pointer-events-none absolute left-[-18rem] top-16 h-[38rem] w-[38rem] rounded-full bg-[var(--teal)]/10 blur-[130px]" />
        <div className="pointer-events-none absolute right-[-8rem] top-0 h-[32rem] w-[32rem] bg-[linear-gradient(rgba(43,175,158,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(43,175,158,.08)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative z-10 max-w-[620px]">
          <p className="text-[clamp(3.5rem,7vw,7rem)] font-black uppercase leading-[.82] tracking-[-.07em] text-[var(--hero-white)] drop-shadow-[0_8px_24px_rgba(43,175,158,.18)]">
            Now <span className="bg-[linear-gradient(180deg,#46d7ca,#149c94)] bg-clip-text text-transparent">Live</span>
          </p>
          <div className="mt-4 h-px w-full max-w-[510px] bg-[linear-gradient(90deg,transparent,var(--teal),transparent)] shadow-[0_0_16px_var(--teal)]" />
          <h1 className="mt-7 text-[clamp(2rem,4vw,3.55rem)] font-bold leading-[1.06] tracking-[-.045em]">
            Healthcare that <span className="text-[var(--teal)]">listens.</span>
          </h1>

          <div className="mt-7 flex max-w-[510px] items-center gap-3">
            <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--teal))]" />
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)] shadow-[0_0_30px_rgba(43,175,158,.28)]"><Icon name="mic" size={27} /></span>
            <div className="h-px flex-1 bg-[linear-gradient(90deg,var(--teal),transparent)]" />
          </div>

          <p className="mt-7 text-[clamp(1.35rem,2.3vw,2rem)] font-semibold leading-snug">Voice-first patient records<br /><span className="text-[var(--teal)]">in Indian languages</span></p>
          <span className="mt-5 inline-flex items-center gap-3 rounded-full border border-[var(--teal)] px-5 py-2.5 text-sm font-semibold text-[var(--teal)]"><span className="text-lg">◎</span> Web + Mobile</span>

          <p className="mt-7 border-t border-[var(--border)] pt-5 text-lg font-medium">Less paperwork. <span className="text-[var(--teal)]">More patient care.</span></p>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Capture consultations, structure the patient record, review clinical history and coordinate care from one secure workspace.</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="focus-ring inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[var(--teal)] px-7 py-4 text-sm font-bold text-[#07110f] shadow-[0_12px_34px_rgba(43,175,158,.2)] transition hover:-translate-y-0.5 hover:brightness-105">
              Access Tri-Care <Icon name="chevron" size={15} />
            </Link>
            <a href="#workflow" className="focus-ring inline-flex h-13 items-center justify-center gap-2 rounded-xl border bg-[var(--ink-elevated)] px-6 py-4 text-sm font-semibold transition hover:border-[var(--teal)]/50">
              See how it works <Icon name="activity" size={15} />
            </a>
          </div>
        </div>
        <div className="relative z-10"><ProductPreview /></div>
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
              <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">Tri-Care uses authenticated, tenant-scoped workspaces with role permissions, private file access and recorded audit activity.</p>
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
            <p className="mt-4 text-sm leading-6 opacity-75">Use your work email, password and hospital code to access Tri-Care securely.</p>
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
          <p className="font-mono text-[9px] text-[var(--faint)]">© 2026 Tri-Care</p>
        </div>
      </footer>
    </main>
  );
}
