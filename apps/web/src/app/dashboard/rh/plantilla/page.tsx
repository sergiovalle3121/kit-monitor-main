'use client';

import React, { useMemo, useState } from 'react';
import { Users, Plus, X, Loader2, CheckCircle2, Inbox, UserMinus } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { RhShell, Kpi, Forbidden, Spinner, RhStyles, COLORS, fmtInt, fmtMoney } from '../_components/ui';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Employee {
  id: string;
  folio: string | null;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  position: string | null;
  area: string | null;
  department: string | null;
  shift: string | null;
  line: string | null;
  laborType: 'DIRECT' | 'INDIRECT';
  employmentType: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  hireDate: string | null;
  monthlyCost: number | null;
}

interface Overview {
  headcount: number;
  direct: number;
  indirect: number;
  directIndirectRatio: number;
  avgTenureYears: number;
  newHires90d: number;
  monthlyLaborCost: number;
}

const STATUS_META: Record<Employee['status'], { label: string; color: string }> = {
  ACTIVE: { label: 'Activo', color: COLORS.green },
  ON_LEAVE: { label: 'Incapacidad/Permiso', color: COLORS.amber },
  TERMINATED: { label: 'Baja', color: COLORS.gray },
};

function tenureLabel(hireDate: string | null): string {
  if (!hireDate) return '—';
  const days = Math.max(0, Math.round((Date.now() - new Date(hireDate).getTime()) / 86400000));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  employeeNumber: '',
  position: '',
  area: '',
  department: '',
  costCenter: '',
  shift: '',
  line: '',
  laborType: 'DIRECT',
  employmentType: 'FULL_TIME',
  hireDate: '',
  monthlyCost: '',
};

export default function PlantillaPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Employee[]>('/hr/employees');
  const { data: ov, mutate: mutateOv } = useApi<Overview>('/hr/analytics/overview');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [areaFilter, setAreaFilter] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const areas = useMemo(
    () => [...new Set(list.map((e) => e.area).filter(Boolean) as string[])].sort(),
    [list],
  );

  const filtered = list.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (areaFilter && e.area !== areaFilter) return false;
    if (q) {
      const hay = `${e.firstName} ${e.lastName} ${e.employeeNumber ?? ''} ${e.position ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  function refresh() {
    mutate();
    mutateOv();
  }

  async function createEmployee() {
    if (form.firstName.trim().length < 1 || form.lastName.trim().length < 1) {
      toast.error('Indica nombre y apellido.', 'Plantilla');
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...form,
        monthlyCost: form.monthlyCost ? Number(form.monthlyCost) : undefined,
        hireDate: form.hireDate || undefined,
      };
      const res = await apiFetch(`${API_BASE}/hr/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error('No se pudo dar de alta.', 'Plantilla');
        return;
      }
      toast.success('Colaborador dado de alta.', 'Plantilla');
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      refresh();
    } catch {
      toast.error('Error de red.', 'Plantilla');
    } finally {
      setBusy(false);
    }
  }

  async function terminate(e: Employee) {
    const type = window.confirm(`Baja de ${e.firstName} ${e.lastName}.\n\nAceptar = Voluntaria · Cancelar = corta`)
      ? 'VOLUNTARY'
      : null;
    if (!type) return;
    const reason = window.prompt('Motivo de la baja:', '') ?? '';
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/hr/employees/${e.id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminationType: type, reason }),
      });
      if (!res.ok) {
        toast.error('No se pudo registrar la baja.', 'Plantilla');
        return;
      }
      toast.success('Baja registrada.', 'Plantilla');
      refresh();
    } catch {
      toast.error('Error de red.', 'Plantilla');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <Forbidden />;

  return (
    <RhShell
      title="Plantilla · Colaboradores"
      subtitle="Maestro de personal, headcount directo/indirecto y movimientos"
      icon={Users}
      color={COLORS.pink}
      action={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: COLORS.pink }}
        >
          <Plus className="w-4 h-4" /> Alta
        </button>
      }
    >
      <RhStyles />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Headcount activo" value={fmtInt(ov?.headcount)} sub={`${fmtInt(ov?.direct)} dir · ${fmtInt(ov?.indirect)} ind`} color={COLORS.pink} />
        <Kpi label="Ratio dir:ind" value={ov ? `${ov.directIndirectRatio}:1` : '—'} color={COLORS.violet} />
        <Kpi label="Antigüedad prom." value={ov ? `${ov.avgTenureYears} a` : '—'} sub={`${fmtInt(ov?.newHires90d)} nuevos (90d)`} color={COLORS.blue} />
        <Kpi label="Costo mensual" value={fmtMoney(ov?.monthlyLaborCost)} color={COLORS.green} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rh-input !w-auto">
          <option value="ACTIVE">Activos</option>
          <option value="ON_LEAVE">Permiso/Incapacidad</option>
          <option value="TERMINATED">Bajas</option>
          <option value="">Todos</option>
        </select>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="rh-input !w-auto">
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre / número…" className="rh-input !w-auto flex-1 min-w-[180px]" />
        <span className="text-[12px] text-gray-400">{filtered.length} de {list.length}</span>
      </div>

      {showForm && (
        <div className={`${glass} rounded-2xl p-5 mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Alta de colaborador</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Nombre"><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rh-input" /></Field>
            <Field label="Apellidos"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rh-input" /></Field>
            <Field label="No. de empleado"><input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="EMP-1042" className="rh-input" /></Field>
            <Field label="Puesto"><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Operador SMT" className="rh-input" /></Field>
            <Field label="Área"><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className="rh-input" /></Field>
            <Field label="Departamento"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Producción" className="rh-input" /></Field>
            <Field label="Centro de costo"><input value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} placeholder="CC-500" className="rh-input" /></Field>
            <Field label="Turno">
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="rh-input">
                <option value="">—</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="MIXTO">Mixto</option>
              </select>
            </Field>
            <Field label="Línea"><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} placeholder="L-01" className="rh-input" /></Field>
            <Field label="Tipo de mano de obra">
              <select value={form.laborType} onChange={(e) => setForm({ ...form, laborType: e.target.value })} className="rh-input">
                <option value="DIRECT">Directa</option><option value="INDIRECT">Indirecta</option>
              </select>
            </Field>
            <Field label="Contratación">
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="rh-input">
                <option value="FULL_TIME">Planta</option><option value="TEMP">Eventual</option><option value="CONTRACTOR">Contratista</option><option value="INTERN">Becario</option>
              </select>
            </Field>
            <Field label="Fecha de ingreso"><input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} className="rh-input" /></Field>
            <Field label="Costo mensual (MXN)"><input type="number" value={form.monthlyCost} onChange={(e) => setForm({ ...form, monthlyCost: e.target.value })} placeholder="18000" className="rh-input" /></Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createEmployee} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: COLORS.pink }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Dar de alta
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className={`${glass} rounded-3xl p-12 text-center`}>
          <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h3 className="font-semibold">Sin colaboradores</h3>
          <p className="text-sm text-gray-400 mt-1">Da de alta personal para construir el headcount y la analítica.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const sm = STATUS_META[e.status];
            return (
              <div key={e.id} className={`${glass} rounded-xl p-4 flex items-center gap-3`}>
                <div className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-semibold flex-shrink-0" style={{ background: `${COLORS.pink}1f`, color: COLORS.pink }}>
                  {e.firstName[0]}{e.lastName[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{e.firstName} {e.lastName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${sm.color}1f`, color: sm.color }}>{sm.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">{e.laborType === 'DIRECT' ? 'Directa' : 'Indirecta'}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-gray-400 truncate">
                    {e.employeeNumber && <span>{e.employeeNumber} · </span>}
                    {e.position ?? 'Sin puesto'}
                    {e.area && <span> · {e.area}</span>}
                    {e.shift && <span> · T{e.shift}</span>}
                    {e.line && <span> · {e.line}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] tabular-nums">{tenureLabel(e.hireDate)}</div>
                  <div className="text-[10px] text-gray-400">antigüedad</div>
                </div>
                {e.status !== 'TERMINATED' && (
                  <button onClick={() => terminate(e)} disabled={busy} title="Dar de baja" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                    <UserMinus className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </RhShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
