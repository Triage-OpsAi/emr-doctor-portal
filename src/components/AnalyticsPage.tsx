"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { PatientDashboardRecord, Workspace } from "@/lib/types";

type DateRange = "7" | "30" | "90" | "365" | "all" | "custom";

const chartColors = ["#315fdd", "#0c9c91", "#8b5cf6", "#ed7a18", "#e05252", "#4f91cc"];
const selectClass = "focus-ring h-11 rounded-xl border border-[#d9e2ed] bg-white px-3 text-sm text-[#31405a] shadow-sm";

function validDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function activityDate(record: PatientDashboardRecord) {
  return validDate(record.last_visit_at) || validDate(record.created_at);
}

function statusLabel(status: string) {
  return status === "approved" ? "Approved" : status === "draft" ? "Draft" : status === "pending_review" ? "Pending review" : status.replaceAll("_", " ");
}

function ageBand(age: number | null) {
  if (age === null) return "Not recorded";
  if (age < 18) return "0–17";
  if (age < 35) return "18–34";
  if (age < 50) return "35–49";
  if (age < 65) return "50–64";
  return "65+";
}

function countBy(values: string[]) {
  return [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map<string, number>())]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function DonutChart({ data, totalLabel }: { data: { label: string; value: number }[]; totalLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`${totalLabel} distribution`}>
          <circle cx="60" cy="60" r="45" fill="none" stroke="#edf1f6" strokeWidth="16" />
          {data.map((item, index) => {
            const length = total ? (item.value / total) * 282.74 : 0;
            const offset = data.slice(0, index).reduce((sum, previous) => sum + (total ? (previous.value / total) * 282.74 : 0), 0);
            return <circle key={item.label} cx="60" cy="60" r="45" fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth="16" strokeDasharray={`${length} ${282.74 - length}`} strokeDashoffset={-offset} />;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-semibold">{total}</p><p className="text-[10px] uppercase tracking-wide text-[#8490a3]">{totalLabel}</p></div></div>
      </div>
      <div className="w-full space-y-3">
        {data.slice(0, 6).map((item, index) => (
          <div key={item.label} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="min-w-0 flex-1 truncate text-[#657189] capitalize">{item.label}</span><strong className="text-[#1b2942]">{item.value}</strong><span className="w-9 text-right text-[#8b96a8]">{total ? Math.round((item.value / total) * 100) : 0}%</span></div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({ data, color = "#315fdd" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return <div className="space-y-4">{data.slice(0, 7).map((item) => <div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-[#526079]">{item.label}</span><strong>{item.value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f6]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }} /></div></div>)}</div>;
}

function TrendChart({ records }: { records: PatientDashboardRecord[] }) {
  const series = useMemo(() => {
    const dated = records.map((record) => validDate(record.created_at)).filter((date): date is Date => Boolean(date));
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const earliest = dated.length ? new Date(Math.min(...dated.map((date) => date.getTime()))) : new Date(end);
    const span = Math.max(13, Math.ceil((end.getTime() - earliest.getTime()) / 86400000));
    const bucketDays = Math.max(1, Math.ceil(span / 13));
    return Array.from({ length: 14 }, (_, index) => {
      const start = new Date(end); start.setDate(end.getDate() - bucketDays * (13 - index)); start.setHours(0, 0, 0, 0);
      const next = new Date(start); next.setDate(start.getDate() + bucketDays);
      return { label: start.toLocaleDateString([], { month: "short", day: "numeric" }), value: dated.filter((date) => date >= start && date < next).length };
    });
  }, [records]);
  const max = Math.max(1, ...series.map((item) => item.value));
  const point = (value: number, index: number) => ({ x: 24 + index * (652 / 13), y: 180 - (value / max) * 134 });
  const points = series.map((item, index) => { const position = point(item.value, index); return `${position.x},${position.y}`; }).join(" ");
  return <div className="overflow-x-auto"><svg viewBox="0 0 700 225" className="min-w-[620px]" role="img" aria-label="Patient registration trend"><defs><linearGradient id="analyticsTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#315fdd" stopOpacity=".3" /><stop offset="1" stopColor="#315fdd" stopOpacity="0" /></linearGradient></defs>{[46, 91, 136, 181].map((y) => <line key={y} x1="24" x2="676" y1={y} y2={y} stroke="#e8edf4" strokeDasharray="4 6" />)}<polygon points={`24,194 ${points} 676,194`} fill="url(#analyticsTrend)" /><polyline points={points} fill="none" stroke="#315fdd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{series.map((item, index) => { const position = point(item.value, index); return <g key={`${item.label}-${index}`}><circle cx={position.x} cy={position.y} r="4" fill="white" stroke="#315fdd" strokeWidth="3" /><text x={position.x} y="216" textAnchor="middle" fontSize="9" fill="#7d899c">{index % 2 === 0 || index === 13 ? item.label : ""}</text></g>; })}</svg></div>;
}

export function AnalyticsPage({ workspace, records, loading }: { workspace: Workspace; records: PatientDashboardRecord[]; loading: boolean }) {
  const [openedAt] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [ward, setWard] = useState("all");
  const [doctor, setDoctor] = useState("all");
  const [gender, setGender] = useState("all");
  const [age, setAge] = useState("all");
  const [department, setDepartment] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const options = useMemo(() => ({
    statuses: [...new Set(records.map((record) => record.status).filter(Boolean))].sort(),
    wards: [...new Set(records.map((record) => record.ward_number).filter((value): value is string => Boolean(value)))].sort(),
    doctors: [...new Set(records.map((record) => record.doctor_name).filter((value): value is string => Boolean(value)))].sort(),
    genders: [...new Set(records.map((record) => record.gender).filter((value): value is string => Boolean(value)))].sort(),
    departments: [...new Set(records.flatMap((record) => record.visits.map((visit) => visit.department)).filter((value): value is string => Boolean(value)))].sort(),
  }), [records]);

  const filtered = useMemo(() => records.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [record.patient_name, record.patient_reference, record.phone || "", record.subject].some((value) => value.toLowerCase().includes(query));
    const date = activityDate(record);
    let matchesDate = true;
    if (dateRange !== "all" && date) {
      if (dateRange === "custom") {
        const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
        matchesDate = (!from || date >= from) && (!to || date <= to);
      } else matchesDate = date >= new Date(openedAt - Number(dateRange) * 86400000);
    } else if (dateRange !== "all" && !date) matchesDate = false;
    return matchesSearch && matchesDate &&
      (status === "all" || record.status === status) &&
      (ward === "all" || record.ward_number === ward) &&
      (doctor === "all" || record.doctor_name === doctor) &&
      (gender === "all" || record.gender === gender) &&
      (age === "all" || ageBand(record.age) === age) &&
      (department === "all" || record.visits.some((visit) => visit.department === department));
  }), [age, dateRange, department, doctor, fromDate, gender, openedAt, records, search, status, toDate, ward]);

  const statusData = countBy(filtered.map((record) => statusLabel(record.status)));
  const ageData = countBy(filtered.map((record) => ageBand(record.age)));
  const genderData = countBy(filtered.map((record) => record.gender || "Not recorded"));
  const wardData = countBy(filtered.map((record) => record.ward_number || "Unassigned"));
  const departmentData = countBy(filtered.flatMap((record) => record.visits.map((visit) => visit.department || "Not recorded")));
  const visitCount = filtered.reduce((total, record) => total + record.visits.length, 0);
  const approved = filtered.filter((record) => record.status === "approved").length;
  const approvalRate = filtered.length ? Math.round((approved / filtered.length) * 100) : 0;
  const averageVisits = filtered.length ? (visitCount / filtered.length).toFixed(1) : "0.0";
  const activeFilterCount = [dateRange !== "all", status !== "all", ward !== "all", doctor !== "all", gender !== "all", age !== "all", department !== "all", Boolean(search)].filter(Boolean).length;

  function clearFilters() {
    setSearch(""); setDateRange("all"); setFromDate(""); setToDate(""); setStatus("all"); setWard("all"); setDoctor("all"); setGender("all"); setAge("all"); setDepartment("all");
  }

  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const headers = ["Patient", "Patient ID", "Age", "Gender", "Ward", "Bed", "Doctor", "Status", "Visits", "Approval", "Last activity"];
    const rows = filtered.map((record) => [record.patient_name, record.patient_reference, record.age, record.gender, record.ward_number, record.bed_number, record.doctor_name, statusLabel(record.status), record.visits.length, record.approval_percentage ?? "", activityDate(record)?.toISOString() || ""]);
    const blob = new Blob([[headers, ...rows].map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `patient-analytics-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-[calc(100vh-74px)] bg-[#f4f7fb] p-4 text-[#13213a] sm:p-6 lg:p-8 xl:p-10">
      <header className="overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_85%_10%,rgba(53,204,190,.3),transparent_26%),linear-gradient(120deg,#092858_0%,#123f78_58%,#0c716e_140%)] p-6 text-white shadow-[0_18px_45px_rgba(10,41,90,.2)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#7ee0d4]">Clinical intelligence</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Patient analytics</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Explore patient activity, demographics, care workload and record completion across {workspace.organization.name}.</p></div><button type="button" onClick={exportCsv} disabled={!filtered.length} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold backdrop-blur hover:bg-white/15 disabled:opacity-40"><Icon name="download" size={16} /> Export filtered CSV</button></div>
      </header>

      <section className="relative z-10 -mt-1 rounded-2xl border border-[#dce4ee] bg-white p-4 shadow-[0_12px_30px_rgba(22,43,77,.08)] sm:mt-6 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search patients</span><Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-[#79869b]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, patient ID, phone or clinical subject" className="focus-ring h-11 w-full rounded-xl border border-[#d9e2ed] bg-white pl-10 pr-3 text-sm placeholder:text-[#929dad]" /></label>
          <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} className={selectClass} aria-label="Date range"><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option><option value="custom">Custom dates</option></select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass} aria-label="Patient status"><option value="all">All statuses</option>{options.statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
          <button type="button" onClick={() => setFiltersOpen((value) => !value)} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d9e2ed] bg-[#f8fafc] px-4 text-sm font-semibold text-[#34435d]"><Icon name="settings" size={16} /> More filters {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#315fdd] px-1 text-[10px] text-white">{activeFilterCount}</span>}</button>
          {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="focus-ring h-11 rounded-xl px-3 text-sm font-semibold text-[#d04d4d] hover:bg-red-50">Reset</button>}
        </div>
        {dateRange === "custom" && <div className="mt-4 flex flex-wrap gap-3 border-t border-[#edf0f5] pt-4"><label className="text-xs text-[#66738a]">From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={`${selectClass} ml-2`} /></label><label className="text-xs text-[#66738a]">To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={`${selectClass} ml-2`} /></label></div>}
        {filtersOpen && <div className="mt-4 grid gap-3 border-t border-[#edf0f5] pt-4 sm:grid-cols-2 lg:grid-cols-5"><select value={ward} onChange={(event) => setWard(event.target.value)} className={selectClass}><option value="all">All wards</option>{options.wards.map((value) => <option key={value}>{value}</option>)}</select><select value={doctor} onChange={(event) => setDoctor(event.target.value)} className={selectClass}><option value="all">All clinicians</option>{options.doctors.map((value) => <option key={value}>{value}</option>)}</select><select value={gender} onChange={(event) => setGender(event.target.value)} className={selectClass}><option value="all">All genders</option>{options.genders.map((value) => <option key={value}>{value}</option>)}</select><select value={age} onChange={(event) => setAge(event.target.value)} className={selectClass}><option value="all">All age groups</option>{["0–17", "18–34", "35–49", "50–64", "65+", "Not recorded"].map((value) => <option key={value}>{value}</option>)}</select><select value={department} onChange={(event) => setDepartment(event.target.value)} className={selectClass}><option value="all">All departments</option>{options.departments.map((value) => <option key={value}>{value}</option>)}</select></div>}
        <p className="mt-4 text-xs text-[#7d899c]">Showing <strong className="text-[#263650]">{filtered.length}</strong> of {records.length} patients</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Filtered patients", filtered.length, "users", "#315fdd", "#edf2ff", "In the current segment"], ["Clinical visits", visitCount, "activity", "#7c3aed", "#f2edff", `${averageVisits} average per patient`], ["Approval rate", `${approvalRate}%`, "shield", "#078777", "#e4f7f1", `${approved} approved records`], ["Active wards", wardData.filter((item) => item.label !== "Unassigned").length, "building", "#e76f13", "#fff1e4", `${wardData[0]?.label || "No ward data"} has highest load`]].map(([label, value, icon, color, background, detail]) => <article key={label} className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)]"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: String(color), background: String(background) }}><Icon name={icon as "users" | "activity" | "shield" | "building"} size={20} /></span><span className="rounded-full bg-[#f4f7fb] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#7d899c]">Live</span></div><p className="mt-5 text-sm text-[#68758d]">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-[#111d34]">{loading ? "—" : value}</p><p className="mt-2 truncate text-xs text-[#8a95a7]">{detail}</p></article>)}</section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]"><article className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Patient registration trend</h2><p className="mt-1 text-xs text-[#78859a]">New patients within the filtered cohort</p></div><span className="rounded-lg bg-[#edf8f6] px-3 py-2 text-xs font-semibold text-[#0c716e]">Live data</span></div><TrendChart records={filtered} /></article><article className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6"><h2 className="text-lg font-semibold">Record status</h2><p className="mt-1 text-xs text-[#78859a]">Completion and review mix</p><div className="mt-7"><DonutChart data={statusData} totalLabel="patients" /></div></article></section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3"><article className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6"><h2 className="text-lg font-semibold">Age distribution</h2><p className="mt-1 text-xs text-[#78859a]">Patients by age band</p><div className="mt-7"><HorizontalBars data={ageData} color="#8b5cf6" /></div></article><article className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6"><h2 className="text-lg font-semibold">Gender profile</h2><p className="mt-1 text-xs text-[#78859a]">Recorded patient demographics</p><div className="mt-7"><DonutChart data={genderData} totalLabel="patients" /></div></article><article className="rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6 lg:col-span-2 xl:col-span-1"><h2 className="text-lg font-semibold">Ward workload</h2><p className="mt-1 text-xs text-[#78859a]">Patients assigned by ward</p><div className="mt-7"><HorizontalBars data={wardData} color="#0c9c91" /></div></article></section>

      {departmentData.length > 0 && <section className="mt-6 rounded-2xl border border-[#dce4ee] bg-white p-5 shadow-[0_8px_24px_rgba(22,43,77,.06)] sm:p-6"><div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]"><div><h2 className="text-lg font-semibold">Department activity</h2><p className="mt-1 text-xs leading-5 text-[#78859a]">Visit volume grouped by the clinical department recorded against each visit.</p><p className="mt-8 text-4xl font-semibold text-[#12203a]">{departmentData.reduce((sum, item) => sum + item.value, 0)}</p><p className="mt-2 text-xs text-[#8490a3]">department-linked visits</p></div><HorizontalBars data={departmentData} color="#ed7a18" /></div></section>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#dce4ee] bg-white shadow-[0_8px_24px_rgba(22,43,77,.06)]"><div className="flex flex-col gap-2 border-b border-[#e4e9f0] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Patient breakdown</h2><p className="mt-1 text-xs text-[#78859a]">The patients behind every chart and KPI above</p></div><span className="text-xs font-semibold text-[#315fdd]">{filtered.length} records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-[#f7f9fc] font-mono text-[9px] uppercase tracking-[.1em] text-[#758197]"><tr>{["Patient", "Demographics", "Location", "Clinician", "Visits", "Approval", "Status", "Last activity"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#e8ecf2]">{filtered.slice(0, 100).map((record) => <tr key={record.id} className="text-sm transition hover:bg-[#f8fafd]"><td className="px-5 py-4"><p className="font-semibold text-[#202e47]">{record.patient_name}</p><p className="mt-1 text-[10px] text-[#8792a4]">{record.patient_reference}</p></td><td className="px-5 py-4 text-xs text-[#5e6c83]">{record.age ?? "—"} yrs · <span className="capitalize">{record.gender || "Not recorded"}</span></td><td className="px-5 py-4 text-xs text-[#5e6c83]">{record.ward_number ? `Ward ${record.ward_number}` : "Unassigned"}{record.bed_number ? ` · Bed ${record.bed_number}` : ""}</td><td className="px-5 py-4 text-xs text-[#5e6c83]">{record.doctor_name || "Not assigned"}</td><td className="px-5 py-4 font-semibold">{record.visits.length}</td><td className="px-5 py-4"><div className="w-24"><div className="mb-1 flex justify-between text-[10px]"><span>{record.approval_percentage ?? (record.status === "approved" ? 100 : 0)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f6]"><div className="h-full rounded-full bg-[#0c9c91]" style={{ width: `${record.approval_percentage ?? (record.status === "approved" ? 100 : 0)}%` }} /></div></div></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${record.status === "approved" ? "bg-emerald-50 text-emerald-700" : record.status === "pending_review" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{statusLabel(record.status)}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-[#69768c]">{activityDate(record)?.toLocaleDateString([], { dateStyle: "medium" }) || "Not recorded"}</td></tr>)}</tbody></table></div>{!loading && filtered.length === 0 && <div className="grid place-items-center px-6 py-16 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edf2ff] text-[#315fdd]"><Icon name="search" size={24} /></span><h3 className="mt-4 font-semibold">No patients match these filters</h3><p className="mt-2 text-sm text-[#7b8799]">Adjust the segment or reset all filters to see the full cohort.</p><button type="button" onClick={clearFilters} className="focus-ring mt-5 rounded-xl bg-[#315fdd] px-4 py-2.5 text-sm font-semibold text-white">Reset filters</button></div>}{filtered.length > 100 && <p className="border-t border-[#e8ecf2] p-4 text-center text-xs text-[#7d899b]">Showing the first 100 patients. Export CSV for the complete filtered cohort.</p>}</section>
    </main>
  );
}
