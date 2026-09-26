"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { Entry, Wording } from "@/lib/demo-consent";

export function InkImage({ entry, label }: { entry?: Entry; label: string }) {
  if (!entry?.ink) return <span className="whitespace-pre-wrap break-words">{entry?.text || "—"}</span>;
  return <svg role="img" aria-label={label} viewBox="0 0 600 100" className="h-20 w-full" preserveAspectRatio="none">{entry.ink.strokes.map((stroke, i) => <polyline key={i} points={stroke.map(([x,y]) => `${x*600},${y*100}`).join(" ")} fill="none" stroke="#172b3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)}</svg>;
}

export function ConsentInkField({ label, value, onChange, wording, required = false }: { label: string; value?: Entry; onChange: (entry: Entry) => void; wording: Wording; required?: boolean }) {
  const [typing, setTyping] = useState(!!value?.text);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const stroke = useRef<[number, number][]>([]);
  const pointer = useRef<number | null>(null);
  const strokes = value?.ink?.strokes || [];
  function point(event: PointerEvent<SVGSVGElement>): [number, number] {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(1,(event.clientX-bounds.left)/bounds.width)), Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))];
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    const next = stroke.current.length >= 2 ? [...strokes, stroke.current] : strokes;
    stroke.current = []; setDraft([]);
    // Handwriting uses the same bounded stroke format as signatures.
    const points = next.flat();
    if (points.length >= 5 && Math.max(...points.map(p => p[0]))-Math.min(...points.map(p => p[0])) >= .02) onChange({text:"",ink:{strokes:next}});
  }
  return <div className="min-w-0"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{label}{required && " *"}</span><button type="button" onClick={() => { setTyping(!typing); stroke.current=[]; pointer.current=null; setDraft([]); onChange({text:"",ink:null}); }} className="text-[11px] font-medium text-teal-700 underline underline-offset-2">{typing ? wording.write : wording.type}</button></div>
    {typing ? <input aria-label={label} required={required} maxLength={300} value={value?.text || ""} onChange={e => onChange({text:e.target.value,ink:null})} className="h-20 w-full border-0 border-b border-slate-300 bg-transparent px-2 text-sm outline-teal-700" /> : <div className="relative border-b border-slate-300 bg-[#fafcfb]">
      {!strokes.length && !draft.length && <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs text-slate-400">{wording.ink_hint}</span>}
      <svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-label={`${label} handwriting area`} className="h-20 w-full touch-none"
        onPointerDown={event => {if (pointer.current !== null || strokes.length >= 100) return; event.currentTarget.setPointerCapture(event.pointerId);pointer.current=event.pointerId;stroke.current=[point(event)];}}
        onPointerMove={event => {if(pointer.current !== event.pointerId || strokes.flat().length+stroke.current.length >= 12000) return;stroke.current.push(point(event));setDraft([...stroke.current]);}}
        onPointerUp={finish} onPointerCancel={() => {pointer.current=null;stroke.current=[];setDraft([]);}}>
        {[...strokes,draft].map((line,i) => <polyline key={i} points={line.map(([x,y]) => `${x*600},${y*100}`).join(" ")} fill="none" stroke="#172b3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg></div>}
    {(value?.text || strokes.length > 0) && <button type="button" onClick={() => {stroke.current=[];pointer.current=null;setDraft([]);onChange({text:"",ink:null});}} className="mt-1 text-[11px] text-slate-500 underline">{wording.clear}</button>}
  </div>;
}
