"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeProvider";
import { TriCareLogo } from "@/components/TriCareLogo";
import { apiFetch, clinicalLogin, fetchClinicalHospitalCode, hasSession } from "@/lib/api";
import { AUDIT_EVENTS, queueAuditEvent } from "@/lib/audit";
import type { Workspace } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [hospitalCode, setHospitalCode] = useState("");
  const [hospitalCodeStatus, setHospitalCodeStatus] = useState<"idle" | "loading" | "found" | "missing" | "unavailable">("idle");
  const [hospitalCodeLookupAttempt, setHospitalCodeLookupAttempt] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Initialize the controlled field from the invitation redirect query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHospitalCode(new URLSearchParams(window.location.search).get("hospital_code") || "");
    if (!hasSession()) return;
    apiFetch<Workspace>("/doctor/workspace")
      .then((workspace) => router.replace(workspace.workspace_path))
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setHospitalCodeStatus("loading");
      try {
        const code = await fetchClinicalHospitalCode(email, controller.signal);
        setHospitalCode(code);
        setHospitalCodeStatus("found");
      } catch (reason) {
        if (controller.signal.aborted) return;
        setHospitalCode("");
        setHospitalCodeStatus(reason instanceof TypeError ? "unavailable" : "missing");
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [email, hospitalCodeLookupAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await clinicalLogin(
        String(form.get("email")),
        String(form.get("password")),
        String(form.get("hospital_code")),
      );
      const workspace = await apiFetch<Workspace>("/doctor/workspace");
      queueAuditEvent({
        action: AUDIT_EVENTS.USER_LOGIN,
        event_category: "authentication",
        resource_type: "session",
        event_metadata: { hospital_code: String(form.get("hospital_code")) },
      });
      router.replace(workspace.workspace_path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[var(--ink)] lg:grid-cols-[1.04fr_.96fr]">
      <div className="pointer-events-none absolute -right-36 -top-40 h-[34rem] w-[34rem] rounded-full bg-[var(--teal)]/10 blur-[120px] lg:hidden" />

      <section className="relative hidden min-h-screen overflow-hidden border-r bg-[var(--ink-elevated)] p-10 lg:flex lg:flex-col xl:p-14">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 18% 12%, rgba(43,175,158,.2), transparent 31%), radial-gradient(circle at 92% 80%, rgba(62,111,242,.14), transparent 28%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)", backgroundSize: "auto, auto, 44px 44px, 44px 44px" }} />
        <Link href="/" className="focus-ring relative flex w-fit items-center gap-3 rounded-lg" aria-label="Back to Tri-Care home">
          <TriCareLogo size={40} className="shadow-[0_10px_30px_rgba(109,40,217,.24)]" />
          <span><span className="block font-display text-base font-semibold leading-none">Tri-Care</span><span className="mt-1.5 block font-mono text-[8px] uppercase tracking-[.2em] text-[var(--faint)]">Doctor portal</span></span>
        </Link>

        <div className="relative my-auto max-w-xl py-16">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[var(--teal)]">Clinical work, connected</p>
          <h1 className="mt-6 font-display text-5xl leading-[1.03] tracking-[-.035em] xl:text-6xl">
            The full patient picture, ready when you are.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[var(--muted)]">
            Move from voice intake to structured records, patient review and coordinated follow-up in one focused clinical workspace.
          </p>
          <div className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
            {[
              ["mic", "Voice intake"],
              ["file", "Patient records"],
              ["shield", "Audited access"],
            ].map(([icon, label]) => (
              <div key={label} className="rounded-2xl border bg-[var(--ink)]/60 p-4 backdrop-blur-sm">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--teal-soft)] text-[var(--teal)]"><Icon name={icon as "mic" | "file" | "shield"} size={15} /></span>
                <p className="mt-4 text-[11px] font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-6 border-t pt-6">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--faint)]">Secure tenant access · Clinical audit trail</p>
          <span className="flex items-center gap-2 text-[10px] text-[var(--muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />System ready</span>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col">
        <header className="flex h-[72px] items-center justify-between border-b px-5 sm:px-8 lg:justify-end lg:px-10">
          <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg lg:hidden" aria-label="Tri-Care home">
            <TriCareLogo size={32} />
            <span className="font-display text-sm font-semibold">Tri-Care</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="focus-ring hidden rounded text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--text)] sm:block">Back to overview</Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="relative grid flex-1 place-items-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="w-full max-w-[470px] rounded-[28px] border bg-[var(--ink-elevated)] p-6 shadow-[0_28px_90px_var(--shadow)] sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--teal)]">Welcome back</p>
                <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-[2.1rem]">Sign in to Tri-Care</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Enter the credentials provided by your hospital.</p>
              </div>
              <span className="hidden h-10 w-10 place-items-center rounded-xl border text-[var(--teal)] sm:grid"><Icon name="shield" size={18} /></span>
            </div>

            {error && (
              <div role="alert" className="mt-6 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-[var(--danger)]">
                <Icon name="help-circle" size={17} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--muted)]">Work email</span>
                <span className="relative block">
                  <Icon name="mail" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                  <input name="email" type="email" required autoComplete="email" value={email} onChange={(event) => {
                    setEmail(event.target.value.trim());
                    setHospitalCode("");
                    setHospitalCodeStatus("idle");
                  }} placeholder="doctor@hospital.com" className="focus-ring h-12 w-full rounded-xl border bg-[var(--ink)] pl-11 pr-3 text-sm transition placeholder:text-[var(--faint)] hover:border-[var(--muted)] focus:border-[var(--teal)]" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold text-[var(--muted)]">Password</span>
                <span className="relative block">
                  <Icon name="shield" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                  <input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" className="focus-ring h-12 w-full rounded-xl border bg-[var(--ink)] pl-11 pr-3 text-sm transition placeholder:text-[var(--faint)] hover:border-[var(--muted)] focus:border-[var(--teal)]" />
                </span>
              </label>
              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-[var(--muted)]">
                  <span>Hospital code</span>
                  {hospitalCodeStatus === "unavailable" ? (
                    <button
                      type="button"
                      onClick={() => setHospitalCodeLookupAttempt((attempt) => attempt + 1)}
                      className="font-mono text-[8px] font-normal uppercase tracking-[.12em] text-[var(--danger)] hover:underline"
                    >
                      Lookup unavailable — retry
                    </button>
                  ) : (
                    <span className="font-mono text-[8px] font-normal uppercase tracking-[.12em] text-[var(--faint)]">
                      {hospitalCodeStatus === "loading" ? "Finding workspace..." : hospitalCodeStatus === "found" ? "Found from email" : hospitalCodeStatus === "missing" ? "Not found — enter code" : "Fetched from your email"}
                    </span>
                  )}
                </span>
                <span className="relative block">
                  <Icon name="building" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                  <input name="hospital_code" required readOnly={hospitalCodeStatus === "loading" || hospitalCodeStatus === "found"} aria-busy={hospitalCodeStatus === "loading"} autoCapitalize="characters" spellCheck={false} value={hospitalCode} onChange={(event) => setHospitalCode(event.target.value.toUpperCase())} placeholder={hospitalCodeStatus === "loading" ? "LOOKING UP..." : hospitalCodeStatus === "missing" ? "ENTER HOSPITAL CODE" : hospitalCodeStatus === "unavailable" ? "ENTER CODE OR RETRY" : "ENTER YOUR WORK EMAIL"} className="focus-ring h-12 w-full rounded-xl border bg-[var(--ink)] pl-11 pr-3 font-mono text-sm uppercase tracking-[.08em] transition placeholder:text-[var(--faint)] read-only:cursor-default" />
                </span>
              </label>
              <button disabled={submitting} className="focus-ring mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--teal)] text-sm font-semibold text-[#07110f] shadow-[0_12px_30px_rgba(43,175,158,.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60">
                {submitting ? <><Icon name="refresh" size={16} className="animate-spin" /> Opening workspace...</> : <>Continue securely <Icon name="chevron" size={15} /></>}
              </button>
            </form>

            <div className="mt-7 border-t pt-5">
              <p className="text-center text-[11px] leading-5 text-[var(--faint)]">
                First time here? Use the secure account setup link sent to your work email.
              </p>
            </div>
          </div>
          <p className="mt-6 flex items-center gap-2 text-[10px] text-[var(--faint)]"><Icon name="shield" size={12} />Your session is scoped to your hospital workspace.</p>
        </div>
      </section>
    </main>
  );
}
