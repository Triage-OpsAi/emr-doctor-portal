"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { useClinicalRefresh } from "@/lib/useClinicalRefresh";
import type { WardVoiceBed } from "@/lib/types";

const definitions = [
  ["systolic_bp","Systolic BP","mmHg"], ["diastolic_bp","Diastolic BP","mmHg"],
  ["blood_glucose","Blood sugar / glucose","mg/dL"], ["temperature","Temperature","C"],
  ["pulse","Pulse","/min"], ["spo2","Oxygen saturation (SpO₂)","%"], ["respiratory_rate","Respiratory rate","/min"],
] as const;
type Reading = {id:string;observation_type:string;value:number|string;unit:string;observed_at:string;recorded_by:string;review_status:string};
export function WardVitals({bed,onChanged,readOnly=false}:{bed:WardVoiceBed|null;onChanged:()=>void;readOnly?:boolean}) {
  const [rows,setRows]=useState<Reading[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const patientId=bed?.patient_id;
  const [observedAt,setObservedAt]=useState(()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16));
  const load=useCallback(async()=>{if(!patientId)return;try{setRows(await apiFetch<Reading[]>(`/ward-voice/patients/${patientId}/vitals`));}catch(e){setError(e instanceof Error?e.message:"Unable to load vitals");}},[patientId]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  useClinicalRefresh(load);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!bed?.patient_id)return;const element=event.currentTarget;const data=new FormData(element);
    const readings=definitions.flatMap(([key,,unit])=>{const value=String(data.get(key)||"").trim();return value?[{observation_type:key,value_numeric:Number(value),unit:String(data.get(`${key}_unit`)||unit)}]:[];});
    if(!readings.length){setError("Enter at least one vital reading.");return;}
    setBusy(true);setError("");
    try{await apiFetch("/ward-voice/vitals",{method:"POST",body:JSON.stringify({bed_id:bed.id,patient_id:bed.patient_id,observed_at:new Date(String(data.get("observed_at"))).toISOString(),readings})});element.reset();await load();onChanged();}
    catch(e){setError(e instanceof Error?e.message:"Unable to save vitals");}finally{setBusy(false);}
  }
  if(!bed?.patient_id)return <p className="rounded-xl bg-white p-8 text-sm text-slate-500">Select a patient to view or record vitals.</p>;
  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"><header><h2 className="text-lg font-bold">Vitals · {bed.patient_name}</h2><p className="mt-1 text-xs text-slate-500">Blood pressure, blood sugar, temperature, pulse, oxygen saturation and respiratory rate.</p></header>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {!readOnly&&<form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{definitions.map(([key,label,unit])=><label key={key} className="text-xs font-semibold text-slate-600">{label}<div className="mt-1 flex gap-2"><input type="number" name={key} aria-label={label} min="0.001" max={key==="spo2"?100:undefined} step="any" className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-sm" />{key==="blood_glucose"||key==="temperature"?<select name={`${key}_unit`} aria-label={`${label} unit`} className="rounded-lg border p-2">{(key==="blood_glucose"?["mg/dL","mmol/L"]:["C","F"]).map(value=><option key={value}>{value}</option>)}</select>:<span className="py-2">{unit}</span>}</div></label>)}</div><label className="block text-xs font-semibold text-slate-600">Observed at<input required type="datetime-local" name="observed_at" value={observedAt} onChange={event=>setObservedAt(event.target.value)} className="mt-1 block rounded-lg border p-2 text-sm" /></label><button type="submit" disabled={busy} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving...":"Confirm and save vitals"}</button></form>}
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b text-slate-500"><tr><th className="py-3 pr-3">Observed</th><th className="pr-3">Vital</th><th className="pr-3">Value</th><th className="pr-3">Recorded by</th><th>Review</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b border-slate-100"><td className="whitespace-nowrap py-3 pr-3">{new Date(row.observed_at).toLocaleString()}</td><td className="pr-3">{definitions.find(([key])=>key===row.observation_type)?.[1]||row.observation_type}</td><td className="whitespace-nowrap pr-3 font-semibold">{row.value} {row.unit}</td><td className="pr-3">{row.recorded_by}</td><td>{row.review_status}</td></tr>)}</tbody></table>{!rows.length&&<p className="py-5 text-sm text-slate-500">No confirmed vitals recorded yet.</p>}</div>
  </section>;
}
