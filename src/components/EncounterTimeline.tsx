"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

export type TimelineEntry = {
  id: string; date: string; department: string | null; clinician: string;
  status: string; summary: ReactNode; recording?: ReactNode; actions?: ReactNode;
  details?: { label: string; value: string }[];
};

export function EncounterTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!entries.length) return <div className="rounded-2xl border border-dashed border-[#d9e7e9] bg-[#f8fbfc] px-6 py-12 text-center"><Icon name="activity" size={28} className="mx-auto text-[#0c716e]" /><h3 className="mt-3 font-semibold">No encounters yet</h3><p className="mt-2 text-sm text-[#6b8293]">New encounters will appear here automatically.</p></div>;
  return <ol aria-label="Encounter timeline" className="space-y-6">
    {[...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, index) => {
      const date = new Date(entry.date);
      const validDate = !Number.isNaN(date.getTime());
      const complete = ["approved", "completed", "synced_to_emr"].includes(entry.status);
      const status = entry.status === "pending_review" ? "Needs review" : entry.status.replaceAll("_", " ");
      const tone = complete ? "bg-[#def5ed] text-[#00856b]" : "bg-amber-50 text-amber-800";
      return <li key={entry.id} className="relative grid gap-3 pl-7 md:grid-cols-[145px_minmax(0,1fr)] md:gap-6 md:pl-8">
        {index < entries.length - 1 && <span aria-hidden="true" className="absolute bottom-[-24px] left-[7px] top-5 w-px bg-[#c9dce1]" />}
        <span aria-hidden="true" className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-[3px] border-[#def4ee] bg-[#008b7b] ring-4 ring-white" />
        <time dateTime={validDate ? entry.date : undefined} className="pt-0.5 text-sm font-semibold text-[#18314c]">{validDate ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Date not recorded"}<span className="mt-1 block text-xs font-normal text-[#728ca3]">{validDate ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</span></time>
        <article className="min-w-0 rounded-2xl border border-[#dce9ed] bg-white shadow-[0_3px_14px_rgba(28,72,89,0.03)]">
          <header className="flex flex-wrap items-center gap-3 rounded-t-2xl border-b border-[#e7eff2] bg-[#f5f9fa] px-5 py-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ddf4ed] text-[#008b7b]"><Icon name="activity" size={23} /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#132b44]">{entry.department ? `${entry.department} consult` : "Clinical encounter"}</h3><span className="rounded-full bg-[#def5ed] px-2.5 py-1 text-[10px] font-semibold text-[#00856b]">Consultation</span></div><p className="mt-1 text-xs text-[#647e93]">{entry.clinician || "Clinician not recorded"}</p></div>
            <span className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${tone}`}>{status}</span>{entry.actions}
          </header>
          <div className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1fr)]">
            <div className="min-w-0 sm:col-span-2 xl:col-span-1"><p className="mb-3 text-xs font-semibold text-[#6b859b]">Encounter summary</p><div className="break-words text-sm leading-6 text-[#425f76]">{entry.summary}</div></div>
            <div><p className="mb-3 text-xs font-semibold text-[#6b859b]">Captured by</p><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ddf4ed] font-semibold text-[#008b7b]">{entry.clinician?.charAt(0).toUpperCase() || "—"}</span><span className="break-words text-sm text-[#425f76]">{entry.clinician || "Not recorded"}</span></div></div>
            <div><p className="mb-3 text-xs font-semibold text-[#6b859b]">Status</p><span className={`inline-block rounded-lg px-2.5 py-2 text-xs font-medium capitalize ${tone}`}>{status}</span></div>
            <div><p className="mb-3 text-xs font-semibold text-[#6b859b]">Recording</p>{entry.recording || <p className="text-xs text-[#8598a5]">No recording</p>}</div>
          </div>
          {!!entry.details?.length && <div className="border-t border-[#edf2f4] px-5 py-3"><button type="button" aria-expanded={expanded === entry.id} aria-controls={`timeline-detail-${entry.id}`} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#dce9ed] px-3 py-2 text-xs font-semibold text-[#41647b] hover:bg-[#f1f8f7]">{expanded === entry.id ? "Hide details" : "View details"}<Icon name="chevron" size={14} /></button>{expanded === entry.id && <dl id={`timeline-detail-${entry.id}`} className="mt-4 grid gap-4 pb-2 sm:grid-cols-2">{entry.details.map(detail => <div key={detail.label}><dt className="text-xs font-semibold text-[#6b859b]">{detail.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#425f76]">{detail.value}</dd></div>)}</dl>}</div>}
        </article>
      </li>;
    })}
  </ol>;
}
