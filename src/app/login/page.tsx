"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
import { apiFetch, clinicalLogin, hasSession } from "@/lib/api";
import { AUDIT_EVENTS, queueAuditEvent } from "@/lib/audit";
import type { Workspace } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [hospitalCode, setHospitalCode] = useState("");
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
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_.9fr] bg-[var(--ink)]">
      <section className="hidden lg:flex relative overflow-hidden border-r border-[var(--border)] p-12 flex-col justify-between bg-[var(--ink-elevated)]">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(43,175,158,.22), transparent 32%), radial-gradient(circle at 85% 72%, rgba(62,111,242,.18), transparent 28%)" }} />
        <div className="relative flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-[var(--teal)] text-[#0d1113] grid place-items-center font-bold text-lg">+</span>
          <span className="font-display text-lg font-semibold">Meridian Health AI</span>
        </div>
        <div className="relative max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[.22em] text-[var(--teal)] mb-5">Clinical intelligence workspace</p>
          <h1 className="font-display text-5xl leading-[1.08] tracking-tight">
            Every patient story,<br />ready for clinical action.
          </h1>
          <p className="mt-6 max-w-md text-[var(--muted)] leading-7">
            Capture, structure, review and manage medical records across your hospital network.
          </p>
        </div>
        <p className="relative text-xs text-[var(--faint)] font-mono">Secure tenant access · Audited clinical records</p>
      </section>

      <section className="min-h-screen flex flex-col">
        <header className="h-16 px-6 md:px-10 flex items-center justify-between border-b border-[var(--border)]">
          <div className="lg:hidden flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[var(--teal)] text-[#0d1113] grid place-items-center font-bold">+</span>
            <span className="font-display font-semibold">Meridian</span>
          </div>
          <span className="hidden lg:block text-xs font-mono text-[var(--faint)]">DOCTOR PORTAL</span>
          <ThemeToggle />
        </header>
        <div className="flex-1 grid place-items-center px-6 py-12">
          <div className="w-full max-w-md">
            <p className="font-mono text-xs text-[var(--teal)] uppercase tracking-[.16em]">Welcome back</p>
            <h2 className="font-display text-3xl mt-3">Sign in to your workspace</h2>
            <p className="text-sm text-[var(--muted)] mt-2">Use the hospital code included in your invitation.</p>
            {error && <p role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="block text-xs font-medium text-[var(--muted)] mb-2">Work email</span>
                <input name="email" type="email" required autoComplete="email" placeholder="doctor@hospital.com" className="focus-ring w-full h-11 rounded-lg border bg-[var(--ink-elevated)] px-3 text-sm placeholder:text-[var(--faint)]" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[var(--muted)] mb-2">Password</span>
                <input name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" className="focus-ring w-full h-11 rounded-lg border bg-[var(--ink-elevated)] px-3 text-sm placeholder:text-[var(--faint)]" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[var(--muted)] mb-2">Hospital code</span>
                <input name="hospital_code" required autoCapitalize="characters" value={hospitalCode} onChange={(event) => setHospitalCode(event.target.value)} placeholder="RAINBO-BLR" className="focus-ring w-full h-11 rounded-lg border bg-[var(--ink-elevated)] px-3 font-mono text-sm uppercase placeholder:text-[var(--faint)]" />
              </label>
              <button disabled={submitting} className="focus-ring w-full h-11 rounded-lg bg-[var(--teal)] text-[#08110f] font-semibold text-sm transition hover:brightness-110 disabled:opacity-60">
                {submitting ? "Opening workspace…" : "Continue securely"}
              </button>
            </form>
            <p className="text-xs text-[var(--faint)] mt-6">
              Joining for the first time? Open the secure setup link sent to your email.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
