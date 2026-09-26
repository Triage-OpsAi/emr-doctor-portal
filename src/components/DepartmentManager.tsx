"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

export type Department = { id: string; name: string; is_active: boolean };
type Member = { id: string; full_name: string; role: string; department_id: string | null };

export function DepartmentManager({ onChanged }: { onChanged?: () => void }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const load = useCallback(async () => {
    const [rows, people] = await Promise.all([apiFetch<Department[]>("/doctor/departments"), apiFetch<Member[]>("/doctor/department-members")]);
    setDepartments(rows); setMembers(people);
  }, []);
  // Synchronize department membership with the server on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch(reason => setError(reason.message)); }, [load]);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await apiFetch("/doctor/departments", { method: "POST", body: JSON.stringify({ name }) }); setName(""); await load(); onChanged?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create department"); }
    finally { setBusy(false); }
  }
  async function assign(member: Member, departmentId: string) {
    setBusy(true); setError("");
    try { await apiFetch(`/doctor/department-members/${member.id}`, { method: "PUT", body: JSON.stringify({ department_id: departmentId || null }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to assign department"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border bg-[var(--ink-elevated)] p-5">
    <h2 className="font-semibold">Departments · all roles</h2><p className="mt-1 text-sm text-[var(--muted)]">Assign doctors, nurses, administrators, and other team members. Departments do not change role permissions.</p>
    {error && <p role="alert" className="my-3 text-red-600">{error}</p>}
    <form onSubmit={create} className="my-4 flex flex-wrap gap-2"><input aria-label="New department name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Radiology, Cardiology…" className="rounded border bg-transparent p-2" /><button disabled={busy} className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">Add department</button></form>
    {!departments.length && <p className="text-sm text-[var(--muted)]">Add your hospital’s departments to begin.</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Team member</th><th className="p-2">Role</th><th className="p-2">Department</th></tr></thead><tbody>
      {members.map(member => <tr key={member.id} className="border-b"><td className="p-2">{member.full_name}</td><td className="p-2">{member.role.replaceAll("_", " ")}</td><td className="p-2"><select aria-label={`Department for ${member.full_name}`} disabled={busy} value={member.department_id || ""} onChange={e => void assign(member, e.target.value)} className="w-full rounded border bg-transparent p-2"><option value="">Unassigned</option>{departments.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td></tr>)}
    </tbody></table></div>
  </section>;
}
