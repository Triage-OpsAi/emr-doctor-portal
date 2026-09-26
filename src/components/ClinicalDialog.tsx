"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ClinicalDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} className="clinical-dialog fixed inset-0 z-50 m-auto max-h-[92vh] w-[min(96vw,1000px)] overflow-auto rounded-2xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/50">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 print:hidden"><h2 className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose} className="rounded border px-3 py-1">Close</button></div>
    {children}
  </dialog>, document.body);
}
