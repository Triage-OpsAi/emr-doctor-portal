"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeProvider";
import { TriCareLogo } from "@/components/TriCareLogo";
import { API_URL } from "@/lib/api";

function InvitationForm() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token") || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hospitalCode, setHospitalCode] = useState("");

  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirm_password")) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }
    const response = await fetch(`${API_URL}/auth/invitations/accept`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.detail || "This invitation is invalid or has expired.");
      setSubmitting(false);
      return;
    }
    setHospitalCode(payload.hospital_code || "");
  }

  if (!token) {
    return <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-[var(--danger)]">The invitation token is missing. Open the complete link from your email.</p>;
  }

  if (hospitalCode) {
    return (
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--teal-soft)] text-2xl text-[var(--teal)]">✓</span>
        <h1 className="font-display mt-5 text-3xl">Your workspace is ready</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Your account has been created. Use this hospital code when signing in:</p>
        <p className="font-mono mx-auto mt-5 w-fit rounded-lg border bg-[var(--ink)] px-5 py-3 text-[var(--teal)]">{hospitalCode}</p>
        <Link href={`/login?hospital_code=${encodeURIComponent(hospitalCode)}`} className="focus-ring mt-6 inline-flex h-11 items-center rounded-lg bg-[var(--teal)] px-6 text-sm font-semibold text-[#07110f]">Continue to sign in</Link>
      </div>
    );
  }

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[.16em] text-[var(--teal)]">Secure invitation</p>
      <h1 className="font-display mt-3 text-3xl">Join your clinical workspace</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Create a password to activate your owner or clinical account.</p>
      {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block"><span className="mb-2 block text-xs text-[var(--muted)]">Create password *</span><input name="password" type="password" required minLength={8} autoComplete="new-password" className="focus-ring h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <label className="block"><span className="mb-2 block text-xs text-[var(--muted)]">Confirm password *</span><input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className="focus-ring h-11 w-full rounded-lg border bg-[var(--ink)] px-3 text-sm" /></label>
        <button disabled={submitting} className="focus-ring h-11 w-full rounded-lg bg-[var(--teal)] text-sm font-semibold text-[#07110f] disabled:opacity-60">{submitting ? "Creating account…" : "Join workspace"}</button>
      </form>
    </>
  );
}

export default function AcceptInvitationPage() {
  return (
    <main className="min-h-screen bg-[var(--ink)]">
      <header className="flex h-16 items-center justify-between border-b px-6 md:px-10">
        <Link href="/login" className="flex items-center gap-2"><TriCareLogo size={32} /><span className="font-display font-semibold">Tri-Care</span></Link>
        <ThemeToggle />
      </header>
      <div className="grid min-h-[calc(100vh-4rem)] place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-[var(--ink-elevated)] p-7 shadow-[0_18px_70px_var(--shadow)]">
          <Suspense fallback={<p className="text-sm text-[var(--muted)]">Opening invitation…</p>}><InvitationForm /></Suspense>
        </div>
      </div>
    </main>
  );
}
