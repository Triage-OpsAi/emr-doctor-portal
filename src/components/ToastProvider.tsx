"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { clearTokens, getSessionTimeRemaining, logoutSession } from "@/lib/api";

export type ToastKind = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_EVENT = "tricare:toast";
const SESSION_EXPIRED_EVENT = "tricare:session-expired";
const SESSION_CHANGED_EVENT = "tricare:session-changed";
const FLASH_TOAST_KEY = "tricare_flash_toast";

export function showToast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, kind } }));
}

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-3), { id, message, kind }]);
    window.setTimeout(() => remove(id), kind === "error" ? 6500 : 4500);
  }, [remove]);

  useEffect(() => {
    const receiveToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; kind?: ToastKind }>).detail;
      if (detail?.message) toast(detail.message, detail.kind);
    };
    window.addEventListener(TOAST_EVENT, receiveToast);

    const flash = sessionStorage.getItem(FLASH_TOAST_KEY);
    if (flash) {
      sessionStorage.removeItem(FLASH_TOAST_KEY);
      toast(flash, "info");
    }
    return () => window.removeEventListener(TOAST_EVENT, receiveToast);
  }, [toast]);

  useEffect(() => {
    let expiryTimer: number | undefined;
    let redirecting = false;

    const expire = (forced = false) => {
      if (redirecting || (!forced && getSessionTimeRemaining() > 0)) return;
      redirecting = true;
      sessionStorage.setItem(FLASH_TOAST_KEY, "Your two-hour session expired. Please sign in again.");
      clearTokens();
      void logoutSession();
      window.location.replace("/login?reason=session_expired");
    };

    const schedule = () => {
      if (expiryTimer) window.clearTimeout(expiryTimer);
      const remaining = getSessionTimeRemaining();
      if (remaining <= 0) {
        expire();
        return;
      }
      expiryTimer = window.setTimeout(expire, Math.min(remaining + 50, 2_147_000_000));
    };

    const onSessionExpired = () => expire(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    window.addEventListener(SESSION_CHANGED_EVENT, schedule);
    window.addEventListener("storage", schedule);
    document.addEventListener("visibilitychange", schedule);
    schedule();

    return () => {
      if (expiryTimer) window.clearTimeout(expiryTimer);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
      window.removeEventListener(SESSION_CHANGED_EVENT, schedule);
      window.removeEventListener("storage", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--ink-elevated)] p-4 text-sm shadow-2xl ${
              item.kind === "error" ? "border-red-500/40 text-[var(--danger)]" :
              item.kind === "success" ? "border-[var(--teal)]/40 text-[var(--teal)]" :
              "border-[var(--signal)]/40 text-[var(--text)]"
            }`}
          >
            <Icon name={item.kind === "error" ? "help-circle" : item.kind === "success" ? "shield" : "bell"} size={17} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 leading-5">{item.message}</span>
            <button type="button" onClick={() => remove(item.id)} className="focus-ring rounded p-0.5 text-[var(--muted)]" aria-label="Dismiss notification">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.toast;
}
