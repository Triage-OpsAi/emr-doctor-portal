"use client";

import { useRef, useState, type PointerEvent } from "react";

export type Signature = { strokes: [number, number][][] };

export function SignatureImage({ signature, label = "Signature" }: { signature: Signature; label?: string }) {
  return <svg role="img" aria-label={label} viewBox="0 0 600 180" className="h-16 w-52 max-w-full">
    {signature.strokes.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x * 600},${y * 180}`).join(" ")} fill="none" stroke="#172b3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

export function SignaturePad({ label, onChange }: { label: string; onChange: (signature: Signature | null) => void }) {
  const [strokes, setStrokes] = useState<[number, number][][]>([]);
  const current = useRef<[number, number][]>([]);
  const active = useRef<number | null>(null);
  const completed = useRef<[number, number][][]>([]);
  function point(event: PointerEvent<SVGSVGElement>): [number, number] {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))];
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (active.current !== event.pointerId) return;
    active.current = null;
    if (current.current.length >= 2) completed.current = [...completed.current, current.current];
    current.current = [];
    setStrokes([...completed.current]);
    const points = completed.current.flat();
    const valid = points.length >= 5 && Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])) >= 0.02;
    onChange(valid ? { strokes: completed.current } : null);
  }
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">{label}</legend>
    <p className="text-xs text-slate-500">Sign below using a mouse, finger, or stylus.</p>
    <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={`${label} drawing area`} className="h-36 w-full touch-none rounded-lg border border-slate-300 bg-white"
      onPointerDown={event => { if (active.current !== null || completed.current.length >= 100) return; event.currentTarget.setPointerCapture(event.pointerId); active.current = event.pointerId; current.current = [point(event)]; }}
      onPointerMove={event => { if (active.current !== event.pointerId || completed.current.flat().length + current.current.length >= 12000) return; current.current.push(point(event)); setStrokes([...completed.current, [...current.current]]); }}
      onPointerUp={finish} onPointerCancel={event => { active.current = null; current.current = []; setStrokes([...completed.current]); event.currentTarget.releasePointerCapture(event.pointerId); }}>
      {strokes.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x * 600},${y * 180}`).join(" ")} fill="none" stroke="#172b3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <button type="button" className="text-sm text-teal-700 underline" onClick={() => { completed.current = []; current.current = []; active.current = null; setStrokes([]); onChange(null); }}>Clear signature</button>
  </fieldset>;
}
