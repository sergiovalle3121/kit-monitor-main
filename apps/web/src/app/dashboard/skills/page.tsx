'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  GraduationCap,
  Plus,
  Lock,
  Loader2,
  X,
  CheckCircle2,
  Search,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Ban,
  Users,
  UserCheck,
  Download,
  BookOpen,
  Pencil,
  Archive,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { saveAs } from 'file-saver';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import { seesAllAreas } from '@/lib/owner';
import {
  DataTable,
  DetailDrawer,
  DrawerSection,
  EmptyState,
  ExportButton,
  KpiRow,
  type ExportColumn,
} from '@/components/workspace';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

// ── Types ────────────────────────────────────────────────────────────────────
type CertStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';
/** Semaphore including the "no certification" gap for matrix cells. */
type Sem = CertStatus | 'NONE';

interface Cert {
  id: string;
  folio: string | null;
  employeeId?: string | null;
  employeeName: string;
  employeeEmail?: string | null;
  skill: string;
  area?: string | null;
  station?: string | null;
  certifiedBy?: string | null;
  status: CertStatus;
  daysToExpiry: number | null;
  issuedDate?: string | null;
  expiresDate?: string | null;
  active: boolean;
}

interface Employee {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  area: string | null;
  station: string | null;
  position: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
}

interface GateCheck {
  certified: boolean;
  status: 'valid' | 'expiring' | 'expired' | 'none';
  expiresDate: string | null;
  daysToExpiry: number | null;
  matchedCertId: string | null;
  employeeName: string | null;
  skill: string | null;
  station: string | null;
}

/** An operator row in the matrix / pickers — real employee or legacy name-only. */
interface Operator {
  key: string;
  employeeId: string | null;
  name: string;
  area: string | null;
  station: string | null;
}

interface SkillDef {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  defaultValidityMonths: number | null;
  description: string | null;
  active: boolean;
}

const SEM_META: Record<Sem, { label: string; color: string }> = {
  VALID: { label: 'Vigente', color: GREEN },
  NO_EXPIRY: { label: 'Sin vencimiento', color: GREEN },
  EXPIRING: { label: 'Por vencer', color: AMBER },
  EXPIRED: { label: 'Vencida', color: RED },
  NONE: { label: 'Sin certificación', color: GRAY },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function normKey(v?: string | null): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}
function fullName(e: Employee): string {
  return `${e.firstName} ${e.lastName}`.replace(/\s+/g, ' ').trim();
}
function opKey(employeeId?: string | null, name?: string | null): string {
  return employeeId ? `id:${employeeId}` : `name:${normKey(name)}`;
}
function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}
/** Best of two semaphores (valid > expiring > expired > none). */
function semRank(s: Sem): number {
  return s === 'VALID' || s === 'NO_EXPIRY' ? 3 : s === 'EXPIRING' ? 2 : s === 'EXPIRED' ? 1 : 0;
}
function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const today = () => new Date().toISOString().slice(0, 10);
/** Add N months to a YYYY-MM-DD date, clamped to month end. Returns YYYY-MM-DD. */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); // overflowed → last day of prev month
  return d.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  employeeId: '',
  employeeName: '',
  employeeEmail: '',
  skill: '',
  area: '',
  station: '',
  certifiedBy: '',
  issuedDate: today(),
  expiresDate: '',
};
type CertForm = typeof EMPTY_FORM;

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Cert[]>('/people/certifications');
  const { data: employeesData } = useApi<Employee[]>('/hr/employees?status=ACTIVE');
  const { data: skillsData, mutate: mutateSkills } = useApi<SkillDef[]>('/people/skills');
  const { user, roles } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const canSeeAll = seesAllAreas(roles?.[0], user?.email);

  const [view, setView] = useState<'matrix' | 'table' | 'gate'>('matrix');
  const [dimension, setDimension] = useState<'station' | 'skill'>('station');
  const [areaFilter, setAreaFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all');
  const [showRoster, setShowRoster] = useState(false);
  const [areaTouched, setAreaTouched] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CertForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [openOpKey, setOpenOpKey] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<Cert[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const employees = useMemo(
    () => (Array.isArray(employeesData) ? employeesData : []),
    [employeesData],
  );
  const skills = useMemo(() => (Array.isArray(skillsData) ? skillsData : []), [skillsData]);

  // Soft area-scope for non-admins: default the area filter to the area of the
  // employee that matches the logged-in email (when we can resolve it). They can
  // still change it (avoids locking someone out when emails don't line up).
  const me = useMemo(
    () =>
      employees.find(
        (e) => e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase(),
      ),
    [employees, user],
  );
  const effectiveAreaFilter = !canSeeAll && me?.area && !areaTouched && !areaFilter ? me.area : areaFilter;

  // Option lists (areas / stations / skills) from real data.
  const areaOptions = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c) => c.area && s.add(c.area));
    employees.forEach((e) => e.area && s.add(e.area));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [list, employees]);
  const stationOptions = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c) => c.station && s.add(c.station));
    employees.forEach((e) => e.station && s.add(e.station));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [list, employees]);
  const skillOptions = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c) => c.skill && s.add(c.skill));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [list]);

  // Operators = union of cert subjects + active roster (for pickers / roster mode).
  const operators = useMemo<Operator[]>(() => {
    const map = new Map<string, Operator>();
    employees.forEach((e) => {
      const key = opKey(e.id, fullName(e));
      map.set(key, { key, employeeId: e.id, name: fullName(e), area: e.area, station: e.station });
    });
    list.forEach((c) => {
      const key = opKey(c.employeeId, c.employeeName);
      if (!map.has(key))
        map.set(key, {
          key,
          employeeId: c.employeeId ?? null,
          name: c.employeeName,
          area: c.area ?? null,
          station: c.station ?? null,
        });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [list, employees]);

  // Certs after the area / station filters (drives KPIs, matrix and table).
  const filteredCerts = useMemo(() => {
    const a = normKey(effectiveAreaFilter);
    const st = normKey(stationFilter);
    return list.filter((c) => {
      if (a && normKey(c.area) !== a) return false;
      if (st && normKey(c.station) !== st) return false;
      return true;
    });
  }, [list, effectiveAreaFilter, stationFilter]);

  // KPIs computed from the filtered set so they always match the matrix colours.
  const kpis = useMemo(() => {
    let vigentes = 0;
    let porVencer = 0;
    let vencidas = 0;
    const emp = new Set<string>();
    const sk = new Set<string>();
    filteredCerts.forEach((c) => {
      emp.add(opKey(c.employeeId, c.employeeName));
      if (c.skill) sk.add(normKey(c.skill));
      if (c.status === 'EXPIRED') vencidas += 1;
      else if (c.status === 'EXPIRING') porVencer += 1;
      else vigentes += 1; // VALID / NO_EXPIRY
    });
    return { vigentes, porVencer, vencidas, employees: emp.size, skills: sk.size };
  }, [filteredCerts]);

  // Status filter layers on top of area/station (KPIs keep reflecting the
  // area/station scope so the headline numbers stay stable while you drill).
  const viewCerts = useMemo(() => {
    if (statusFilter === 'all') return filteredCerts;
    return filteredCerts.filter((c) =>
      statusFilter === 'valid'
        ? c.status === 'VALID' || c.status === 'NO_EXPIRY'
        : statusFilter === 'expiring'
          ? c.status === 'EXPIRING'
          : c.status === 'EXPIRED',
    );
  }, [filteredCerts, statusFilter]);

  function refresh() {
    mutate();
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  async function createCert() {
    const hasRoster = employees.length > 0;
    if (hasRoster && !form.employeeId && form.employeeName.trim().length < 2) {
      toast.error('Selecciona un empleado.', 'Skills');
      return;
    }
    if (form.employeeName.trim().length < 2 || form.skill.trim().length < 2) {
      toast.error('Indica empleado y skill.', 'Skills');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/people/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId || undefined,
          employeeName: form.employeeName,
          employeeEmail: form.employeeEmail || undefined,
          skill: form.skill,
          area: form.area || undefined,
          station: form.station || undefined,
          certifiedBy: form.certifiedBy || undefined,
          issuedDate: form.issuedDate || undefined,
          expiresDate: form.expiresDate || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo registrar.', 'Skills');
        return;
      }
      toast.success('Certificación registrada.', 'Skills');
      setShowForm(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch {
      toast.error('Error de red.', 'Skills');
    } finally {
      setBusy(false);
    }
  }

  async function patchCert(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/people/certifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error('No se pudo actualizar.', 'Skills');
        return;
      }
      toast.success(okMsg, 'Skills');
      refresh();
    } catch {
      toast.error('Error de red.', 'Skills');
    } finally {
      setBusy(false);
    }
  }

  function renew(c: Cert) {
    const nd = window.prompt('Nueva fecha de vencimiento (YYYY-MM-DD):', '');
    if (!nd) return;
    void patchCert(c.id, { expiresDate: nd, issuedDate: today(), active: true }, 'Recertificado.');
  }
  function revoke(c: Cert) {
    if (!window.confirm(`¿Revocar / marcar vencida la certificación de ${c.employeeName}?`)) return;
    void patchCert(c.id, { active: false }, 'Certificación revocada.');
  }

  function openCreateFor(op?: Operator, station?: string) {
    setForm({
      ...EMPTY_FORM,
      employeeId: op?.employeeId ?? '',
      employeeName: op?.name ?? '',
      area: op?.area ?? '',
      station: station ?? op?.station ?? '',
    });
    setOpenOpKey(null);
    setShowForm(true);
  }

  /** Jump from a KPI / recert banner straight to the actionable list. */
  function focusStatus(s: 'expiring' | 'expired') {
    setStatusFilter(s);
    setView('table');
  }

  // ── Forbidden / loading ────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver skills.</p>
        </div>
      </div>
    );
  }

  const drawerOp = openOpKey ? operators.find((o) => o.key === openOpKey) ?? null : null;
  const drawerCerts = drawerOp
    ? list.filter((c) => opKey(c.employeeId, c.employeeName) === drawerOp.key)
    : [];

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <GraduationCap className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">RH · Skills y Certificaciones</h1>
            <p className="text-[12px] text-gray-400 leading-tight">
              Matriz de competencias operador × estación · gate IATF
            </p>
          </div>
          <button
            onClick={() => setShowCatalog(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
            title="Catálogo de skills"
          >
            <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Catálogo</span>
          </button>
          <button
            onClick={() => openCreateFor()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: VIOLET }}
          >
            <Plus className="w-4 h-4" /> Certificar
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs (cuadran con la matriz: misma fuente filtrada) */}
        <KpiRow
          className="mb-6"
          items={[
            {
              label: 'Certificaciones vigentes',
              value: kpis.vigentes,
              sublabel: `${kpis.employees} operadores · ${kpis.skills} skills`,
              color: GREEN,
              icon: ShieldCheck,
            },
            {
              label: 'Por vencer',
              value: kpis.porVencer,
              sublabel: 'dentro de la ventana de alerta',
              color: kpis.porVencer > 0 ? AMBER : GREEN,
              icon: RefreshCw,
            },
            {
              label: 'Vencidas',
              value: kpis.vencidas,
              color: kpis.vencidas > 0 ? RED : GREEN,
              icon: ShieldAlert,
            },
            { label: 'Skills cubiertos', value: kpis.skills, color: VIOLET, icon: GraduationCap },
          ]}
        />

        {/* Recertification urgency banner (actionable) */}
        {!isLoading && list.length > 0 && (kpis.porVencer > 0 || kpis.vencidas > 0) && (
          <div
            className={`${glass} rounded-2xl px-4 py-3 mb-5 flex flex-wrap items-center gap-3`}
            style={{ borderLeft: `3px solid ${kpis.vencidas > 0 ? RED : AMBER}` }}
          >
            <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: kpis.vencidas > 0 ? RED : AMBER }} />
            <p className="text-sm flex-1 min-w-0">
              <b>Recertificaciones pendientes:</b>{' '}
              {kpis.porVencer > 0 && (
                <span style={{ color: AMBER }}>{kpis.porVencer} por vencer</span>
              )}
              {kpis.porVencer > 0 && kpis.vencidas > 0 && ' · '}
              {kpis.vencidas > 0 && <span style={{ color: RED }}>{kpis.vencidas} vencidas</span>}
              <span className="text-gray-400"> en el alcance actual.</span>
            </p>
            {kpis.porVencer > 0 && (
              <button
                onClick={() => focusStatus('expiring')}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                style={{ background: `${AMBER}1f`, color: AMBER }}
              >
                Ver por vencer
              </button>
            )}
            {kpis.vencidas > 0 && (
              <button
                onClick={() => focusStatus('expired')}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                style={{ background: `${RED}14`, color: RED }}
              >
                Ver vencidas
              </button>
            )}
          </div>
        )}

        {/* View switcher + filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Segmented
            value={view}
            onChange={(v) => setView(v as typeof view)}
            options={[
              { value: 'matrix', label: 'Matriz', icon: LayoutGrid },
              { value: 'table', label: 'Tabla', icon: TableIcon },
              { value: 'gate', label: 'Gate operador↔estación', icon: ShieldCheck },
            ]}
          />
          <div className="flex-1" />
          {(view === 'matrix' || view === 'table') && (
            <>
              <select
                value={effectiveAreaFilter}
                onChange={(e) => {
                  setAreaTouched(true);
                  setAreaFilter(e.target.value);
                }}
                className="sk-input !w-auto"
                aria-label="Filtrar por área"
              >
                <option value="">Todas las áreas</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="sk-input !w-auto"
                aria-label="Filtrar por estación"
              >
                <option value="">Todas las estaciones</option>
                {stationOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="sk-input !w-auto"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos los estados</option>
                <option value="valid">Vigentes</option>
                <option value="expiring">Por vencer</option>
                <option value="expired">Vencidas</option>
              </select>
            </>
          )}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            accent={VIOLET}
            title="Construye tu matriz de competencias"
            description="Una matriz operador × estación con vigencias: quién está certificado para cada estación, quién está por vencer y dónde tienes huecos — la evidencia que pide IATF."
            hint={[
              'Liga cada certificación a un empleado real de tu plantilla',
              'Semáforo por celda: vigente, por vencer, vencida o sin certificación',
              'Gate operador↔estación: advierte antes de asignar a un no certificado',
            ]}
            primaryAction={{
              label: 'Registrar primera certificación',
              icon: Plus,
              onClick: () => openCreateFor(),
            }}
            secondaryAction={{
              label: 'Importar empleados',
              icon: Users,
              onClick: () => router.push('/dashboard/rh/plantilla'),
            }}
          />
        ) : view === 'gate' ? (
          <GateView
            operators={operators}
            stationOptions={stationOptions}
            onCertify={(op, station) => openCreateFor(op, station)}
          />
        ) : view === 'table' ? (
          <CertTable
            certs={viewCerts}
            onRow={(c) => setOpenOpKey(opKey(c.employeeId, c.employeeName))}
            onFiltered={setTableRows}
            exportRows={tableRows.length ? tableRows : viewCerts}
          />
        ) : (
          <MatrixView
            certs={viewCerts}
            operators={operators}
            dimension={dimension}
            onDimension={setDimension}
            showRoster={showRoster}
            onToggleRoster={() => setShowRoster((s) => !s)}
            areaFilter={effectiveAreaFilter}
            onOpenOperator={setOpenOpKey}
            onCreate={() => openCreateFor()}
          />
        )}
      </main>

      {/* Alta / edición */}
      {showForm && (
        <CertFormModal
          form={form}
          setForm={setForm}
          busy={busy}
          employees={employees}
          skills={skills}
          areaOptions={areaOptions}
          stationOptions={stationOptions}
          skillOptions={skillOptions}
          onClose={() => setShowForm(false)}
          onSubmit={createCert}
          onManageCatalog={() => setShowCatalog(true)}
        />
      )}

      {/* Catálogo de skills */}
      {showCatalog && (
        <SkillCatalogModal skills={skills} onClose={() => setShowCatalog(false)} onChanged={() => mutateSkills()} />
      )}

      {/* Detalle por empleado */}
      <DetailDrawer
        open={!!drawerOp}
        onClose={() => setOpenOpKey(null)}
        title={drawerOp?.name ?? ''}
        subtitle={
          drawerOp
            ? [drawerOp.area, drawerOp.employeeId ? 'empleado ligado' : 'sólo por nombre (dato viejo)']
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        icon={UserCheck}
        accent={VIOLET}
        actions={
          drawerOp && (
            <button
              onClick={() => openCreateFor(drawerOp)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: VIOLET }}
            >
              <Plus className="w-4 h-4" /> Registrar certificación
            </button>
          )
        }
      >
        {drawerOp && (
          <EmployeeDetail certs={drawerCerts} busy={busy} onRenew={renew} onRevoke={revoke} />
        )}
      </DetailDrawer>

      <style jsx global>{`
        .sk-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .sk-input:focus {
          border-color: #7c3aed;
        }
        :global(.dark) .sk-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: white;
        }
      `}</style>
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────────
function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon: React.ElementType }[];
}) {
  return (
    <div className={`${glass} inline-flex rounded-xl p-1 gap-1`}>
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              active ? 'text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
            style={active ? { background: VIOLET } : undefined}
            aria-pressed={active}
          >
            <Icon className="w-4 h-4" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, days }: { status: Sem; days?: number | null }) {
  const m = SEM_META[status];
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
      style={{ background: `${m.color}1f`, color: m.color }}
    >
      {m.label}
      {status === 'EXPIRING' && days != null ? ` · ${days}d` : ''}
    </span>
  );
}

// ── Matrix view ───────────────────────────────────────────────────────────────
function MatrixView({
  certs,
  operators,
  dimension,
  onDimension,
  showRoster,
  onToggleRoster,
  areaFilter,
  onOpenOperator,
  onCreate,
}: {
  certs: Cert[];
  operators: Operator[];
  dimension: 'station' | 'skill';
  onDimension: (d: 'station' | 'skill') => void;
  showRoster: boolean;
  onToggleRoster: () => void;
  areaFilter: string;
  onOpenOperator: (key: string) => void;
  onCreate: () => void;
}) {
  const { rows, columns, cells, coverage, rowCoverage } = useMemo(() => {
    const colKeyOf = (c: Cert) => (dimension === 'station' ? c.station : c.skill);
    // Columns: distinct dimension values present in the filtered certs.
    const colMap = new Map<string, string>();
    certs.forEach((c) => {
      const v = colKeyOf(c);
      if (v) colMap.set(normKey(v), v.trim());
    });

    // Rows: operators that appear in the filtered certs; optionally the full
    // active roster (filtered by area) so gaps show as grey rows.
    const rowMap = new Map<string, Operator>();
    const aKey = normKey(areaFilter);
    certs.forEach((c) => {
      const key = opKey(c.employeeId, c.employeeName);
      if (!rowMap.has(key))
        rowMap.set(key, {
          key,
          employeeId: c.employeeId ?? null,
          name: c.employeeName,
          area: c.area ?? null,
          station: c.station ?? null,
        });
    });
    if (showRoster) {
      operators.forEach((o) => {
        if (aKey && normKey(o.area) !== aKey) return;
        if (!rowMap.has(o.key)) rowMap.set(o.key, o);
        if (dimension === 'station' && o.station) colMap.set(normKey(o.station), o.station.trim());
      });
    }

    // Cells: best semaphore + nearest expiry per (operator, column).
    const cellMap = new Map<string, { status: Sem; days: number | null; count: number }>();
    certs.forEach((c) => {
      const v = colKeyOf(c);
      if (!v) return;
      const key = `${opKey(c.employeeId, c.employeeName)}|${normKey(v)}`;
      const prev = cellMap.get(key);
      const status: Sem = c.status;
      if (!prev || semRank(status) > semRank(prev.status)) {
        cellMap.set(key, { status, days: c.daysToExpiry, count: (prev?.count ?? 0) + 1 });
      } else {
        cellMap.set(key, { ...prev, count: prev.count + 1 });
      }
    });

    // Coverage per column = distinct operators with a usable (valid/expiring)
    // cert; per row = how many columns the operator is enabled for. Zero-coverage
    // columns are the IATF gaps to staff.
    const coverage = new Map<string, number>();
    const rowCoverage = new Map<string, number>();
    cellMap.forEach((v, k) => {
      if (semRank(v.status) >= 2) {
        const [rowKey, colKey] = k.split('|');
        coverage.set(colKey, (coverage.get(colKey) ?? 0) + 1);
        rowCoverage.set(rowKey, (rowCoverage.get(rowKey) ?? 0) + 1);
      }
    });

    const rows = [...rowMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const columns = [...colMap.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { rows, columns, cells: cellMap, coverage, rowCoverage };
  }, [certs, operators, dimension, showRoster, areaFilter]);

  function exportMatrix() {
    const dimLabel = dimension === 'station' ? 'Estación' : 'Skill';
    const header = ['Operador', 'Área', ...columns.map((c) => c.label), `Habilitado (${dimLabel})`];
    const body = rows.map((r) => {
      const vals = columns.map((c) => {
        const cell = cells.get(`${r.key}|${c.key}`);
        return cell ? SEM_META[cell.status].label : '';
      });
      return [r.name, r.area ?? '', ...vals, String(rowCoverage.get(r.key) ?? 0)];
    });
    const footer = ['Cobertura', '', ...columns.map((c) => String(coverage.get(c.key) ?? 0)), ''];
    const csv =
      '﻿' +
      [header, ...body, footer].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    saveAs(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `matriz-competencias-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-gray-400">Columnas:</span>
          <Segmented
            value={dimension}
            onChange={(v) => onDimension(v as 'station' | 'skill')}
            options={[
              { value: 'station', label: 'Estación', icon: LayoutGrid },
              { value: 'skill', label: 'Skill', icon: GraduationCap },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[13px] text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={showRoster} onChange={onToggleRoster} className="accent-violet-600" />
            Mostrar plantilla completa (huecos)
          </label>
          {columns.length > 0 && (
            <button
              onClick={exportMatrix}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm font-medium transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              title="Exporta la rejilla operador × columna con su estado (auditoría IATF)"
            >
              <Download className="h-4 w-4" /> Exportar matriz
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-gray-500">
        {(['VALID', 'EXPIRING', 'EXPIRED', 'NONE'] as Sem[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: SEM_META[s].color }} /> {SEM_META[s].label}
          </span>
        ))}
      </div>

      {rows.length === 0 || columns.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <Users className="w-7 h-7 mx-auto mb-2 text-gray-400" />
          <h3 className="font-semibold">Sin datos para esta vista</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            No hay certificaciones para el filtro actual. Liga empleados y registra certificaciones para poblar la
            matriz.
          </p>
          <button
            onClick={onCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: VIOLET }}
          >
            <Plus className="w-4 h-4" /> Registrar certificación
          </button>
        </div>
      ) : (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10">
                  <th className="sticky left-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 min-w-[180px]">
                    Operador
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-2.5 text-center text-[11px] font-medium text-gray-500 min-w-[68px]"
                      title={col.label}
                    >
                      <span className="block max-w-[96px] mx-auto truncate">{col.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="sticky left-0 z-10 bg-white/80 dark:bg-neutral-900/80 backdrop-blur px-3 py-2">
                      <button
                        onClick={() => onOpenOperator(row.key)}
                        className="text-left min-w-0 group"
                        title="Ver perfil de competencias"
                      >
                        <span className="block font-medium truncate group-hover:text-violet-600">{row.name}</span>
                        <span className="block text-[11px] text-gray-400 truncate">
                          {[row.area, `${rowCoverage.get(row.key) ?? 0} hab.`].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </td>
                    {columns.map((col) => {
                      const cell = cells.get(`${row.key}|${col.key}`);
                      const status: Sem = cell?.status ?? 'NONE';
                      const m = SEM_META[status];
                      return (
                        <td key={col.key} className="px-1.5 py-1.5 text-center">
                          <button
                            onClick={() => onOpenOperator(row.key)}
                            title={`${row.name} · ${col.label} — ${m.label}${
                              cell?.days != null ? ` (${cell.days}d)` : ''
                            }`}
                            className="w-full h-8 rounded-md grid place-items-center transition-transform hover:scale-[1.04]"
                            style={{ background: status === 'NONE' ? 'transparent' : `${m.color}26` }}
                          >
                            {status === 'NONE' ? (
                              <span className="text-gray-300 dark:text-gray-600">·</span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
                  <td className="sticky left-0 z-10 bg-white/85 dark:bg-neutral-900/85 backdrop-blur px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Cobertura
                  </td>
                  {columns.map((col) => {
                    const n = coverage.get(col.key) ?? 0;
                    return (
                      <td
                        key={col.key}
                        className="px-1.5 py-2 text-center"
                        title={`${n} de ${rows.length} operadores certificados para ${col.label}`}
                      >
                        <span
                          className="text-[12px] font-semibold tabular-nums"
                          style={{ color: n === 0 ? RED : GREEN }}
                        >
                          {n === 0 ? '0 ⚠' : n}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table view (DataTable + CSV export) ───────────────────────────────────────
function CertTable({
  certs,
  onRow,
  onFiltered,
  exportRows,
}: {
  certs: Cert[];
  onRow: (c: Cert) => void;
  onFiltered: (rows: Cert[]) => void;
  exportRows: Cert[];
}) {
  const columns = useMemo<ColumnDef<Cert, unknown>[]>(
    () => [
      {
        accessorKey: 'folio',
        header: 'Folio',
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-gray-500">{row.original.folio ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'employeeName',
        header: 'Empleado',
        meta: { filterable: true, filterPlaceholder: 'Nombre…' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-medium">
            {row.original.employeeName}
            {!row.original.employeeId && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600" title="Sin ligar a empleado">
                viejo
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'skill',
        header: 'Skill',
        meta: { filterable: true, filterPlaceholder: 'Skill…' },
      },
      { accessorKey: 'area', header: 'Área', cell: ({ row }) => row.original.area ?? '—' },
      { accessorKey: 'station', header: 'Estación', cell: ({ row }) => row.original.station ?? '—' },
      {
        accessorKey: 'certifiedBy',
        header: 'Certificó',
        cell: ({ row }) => (
          <span className="text-gray-500">{row.original.certifiedBy ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'expiresDate',
        header: 'Vence',
        cell: ({ row }) => fmtDate(row.original.expiresDate),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => <StatusPill status={row.original.status} days={row.original.daysToExpiry} />,
      },
    ],
    [],
  );

  const exportColumns: ExportColumn<Cert>[] = [
    { key: 'folio', header: 'Folio' },
    { key: 'employeeName', header: 'Empleado' },
    { key: 'employeeId', header: 'Empleado ID', value: (c) => c.employeeId ?? '' },
    { key: 'skill', header: 'Skill' },
    { key: 'area', header: 'Área', value: (c) => c.area ?? '' },
    { key: 'station', header: 'Estación', value: (c) => c.station ?? '' },
    { key: 'certifiedBy', header: 'Certificó', value: (c) => c.certifiedBy ?? '' },
    { key: 'issuedDate', header: 'Certificado', value: (c) => (c.issuedDate ? c.issuedDate.slice(0, 10) : '') },
    { key: 'expiresDate', header: 'Vence', value: (c) => (c.expiresDate ? c.expiresDate.slice(0, 10) : '') },
    { key: 'status', header: 'Estado', value: (c) => SEM_META[c.status].label },
  ];

  return (
    <DataTable
      data={certs}
      columns={columns}
      getRowId={(c) => c.id}
      onRowClick={onRow}
      onFilteredRowsChange={onFiltered}
      searchPlaceholder="Buscar empleado, skill, estación…"
      toolbarRight={<ExportButton rows={exportRows} columns={exportColumns} filename="matriz-competencias" />}
      emptyState={
        <div className="p-12 text-center text-sm text-gray-400">Sin certificaciones para el filtro actual.</div>
      }
    />
  );
}

// ── Employee detail (drawer body) ─────────────────────────────────────────────
function EmployeeDetail({
  certs,
  busy,
  onRenew,
  onRevoke,
}: {
  certs: Cert[];
  busy: boolean;
  onRenew: (c: Cert) => void;
  onRevoke: (c: Cert) => void;
}) {
  const enabled = useMemo(() => {
    const map = new Map<string, Sem>();
    certs.forEach((c) => {
      if (!c.station) return;
      if (c.status === 'EXPIRED') return;
      const k = c.station.trim();
      const prev = map.get(k);
      const s: Sem = c.status;
      if (!prev || semRank(s) > semRank(prev)) map.set(k, s);
    });
    return [...map.entries()];
  }, [certs]);

  const sorted = useMemo(
    () => [...certs].sort((a, b) => semRank(b.status) - semRank(a.status)),
    [certs],
  );

  return (
    <>
      <DrawerSection title="Habilitado hoy (estaciones vigentes)">
        {enabled.length === 0 ? (
          <p className="text-sm text-gray-400">Sin estaciones habilitadas con certificación vigente.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enabled.map(([station, s]) => (
              <span
                key={station}
                className="text-[12px] px-2 py-1 rounded-lg font-medium"
                style={{ background: `${SEM_META[s].color}1f`, color: SEM_META[s].color }}
              >
                {station}
              </span>
            ))}
          </div>
        )}
      </DrawerSection>

      <DrawerSection title={`Certificaciones (${certs.length})`}>
        <div className="space-y-2">
          {sorted.map((c) => (
            <div key={c.id} className={`${glass} rounded-xl p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.skill}</div>
                  <div className="text-[12px] text-gray-400 truncate">
                    {[c.area, c.station].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <StatusPill status={c.status} days={c.daysToExpiry} />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-400 flex flex-wrap gap-x-3">
                <span>Certificado: {fmtDate(c.issuedDate)}</span>
                <span>Vence: {fmtDate(c.expiresDate)}</span>
                {c.certifiedBy && <span>Por: {c.certifiedBy}</span>}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onRenew(c)}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-lg text-[12px] font-medium disabled:opacity-50"
                  style={{ background: `${GREEN}1f`, color: GREEN }}
                >
                  <RefreshCw className="w-3 h-3 inline -mt-0.5 mr-1" />
                  Renovar
                </button>
                {c.active && (
                  <button
                    onClick={() => onRevoke(c)}
                    disabled={busy}
                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium disabled:opacity-50"
                    style={{ background: `${RED}14`, color: RED }}
                  >
                    <Ban className="w-3 h-3 inline -mt-0.5 mr-1" />
                    Revocar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DrawerSection>
    </>
  );
}

// ── Gate view (operator↔station verifier) ─────────────────────────────────────
function GateView({
  operators,
  stationOptions,
  onCertify,
}: {
  operators: Operator[];
  stationOptions: string[];
  onCertify: (op: Operator, station: string) => void;
}) {
  const [opKeySel, setOpKeySel] = useState('');
  const [station, setStation] = useState('');
  const op = operators.find((o) => o.key === opKeySel) ?? null;

  const path =
    op && station
      ? `/people/certification-check?employee=${encodeURIComponent(op.name)}` +
        (op.employeeId ? `&employeeId=${encodeURIComponent(op.employeeId)}` : '') +
        `&station=${encodeURIComponent(station)}`
      : null;
  const { data: check, isLoading } = useApi<GateCheck>(path);

  const verdict = check
    ? check.status === 'valid'
      ? { color: GREEN, icon: ShieldCheck, title: `Operador certificado para ${station}`, sub: check.expiresDate ? `Vence ${fmtDate(check.expiresDate)}` : 'Sin vencimiento' }
      : check.status === 'expiring'
        ? { color: AMBER, icon: ShieldCheck, title: `Certificado — por vencer (${station})`, sub: `Vence ${fmtDate(check.expiresDate)} · recertificar pronto` }
        : check.status === 'expired'
          ? { color: RED, icon: ShieldAlert, title: `⚠ Certificación VENCIDA para ${station}`, sub: `Venció ${fmtDate(check.expiresDate)}` }
          : { color: RED, icon: ShieldAlert, title: `⚠ Operador no certificado para ${station}`, sub: 'Sin certificación vigente para esta estación' }
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-[340px_1fr]">
      <div className={`${glass} rounded-2xl p-5`}>
        <h3 className="font-semibold mb-1">Verificar habilitación</h3>
        <p className="text-[12px] text-gray-400 mb-4">
          Antes de asignar un operador a una estación, confirma si está certificado.
        </p>
        <label className="block mb-3">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Operador</span>
          <select value={opKeySel} onChange={(e) => setOpKeySel(e.target.value)} className="sk-input">
            <option value="">Selecciona operador…</option>
            {operators.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
                {o.area ? ` · ${o.area}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Estación</span>
          <input
            list="gate-stations"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder="SMT-1"
            className="sk-input"
          />
          <datalist id="gate-stations">
            {stationOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>

      <div className={`${glass} rounded-2xl p-6 grid place-items-center text-center`}>
        {!path ? (
          <div className="text-gray-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Elige un operador y una estación para ver el veredicto.</p>
          </div>
        ) : isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        ) : verdict ? (
          <div>
            <span
              className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-4"
              style={{ background: `${verdict.color}1f`, color: verdict.color }}
            >
              <verdict.icon className="w-8 h-8" />
            </span>
            <h3 className="text-lg font-semibold" style={{ color: verdict.color }}>
              {verdict.title}
            </h3>
            <p className="text-sm text-gray-400 mt-1">{verdict.sub}</p>
            {check && !check.certified && op && (
              <button
                onClick={() => onCertify(op, station)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: VIOLET }}
              >
                <Plus className="w-4 h-4" /> Certificar para esta estación
              </button>
            )}
            <p className="mt-5 text-[11px] text-gray-400 max-w-sm mx-auto">
              Modo <b>advertencia</b>: no bloquea la asignación. El modo bloqueo duro está preparado en el backend pero
              desactivado (lo endurece el owner con un flag).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Certification form (modal) ────────────────────────────────────────────────
function CertFormModal({
  form,
  setForm,
  busy,
  employees,
  skills,
  areaOptions,
  stationOptions,
  skillOptions,
  onClose,
  onSubmit,
  onManageCatalog,
}: {
  form: CertForm;
  setForm: (f: CertForm) => void;
  busy: boolean;
  employees: Employee[];
  skills: SkillDef[];
  areaOptions: string[];
  stationOptions: string[];
  skillOptions: string[];
  onClose: () => void;
  onSubmit: () => void;
  onManageCatalog: () => void;
}) {
  const hasRoster = employees.length > 0;

  // Picking a catalog skill prefills the suggested area and auto-computes the
  // expiry from its default validity (when those fields are still empty).
  function onSkillChange(value: string) {
    const match = skills.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
    const next: CertForm = { ...form, skill: value };
    if (match) {
      if (!form.area && match.area) next.area = match.area;
      if (!form.expiresDate && match.defaultValidityMonths) {
        next.expiresDate = addMonths(form.issuedDate || today(), match.defaultValidityMonths);
      }
    }
    setForm(next);
  }

  // Catalog names first, then any free-text skills already used on certs.
  const skillList = [
    ...skills.map((s) => s.name),
    ...skillOptions.filter((s) => !skills.some((k) => k.name.toLowerCase() === s.toLowerCase())),
  ];
  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Registrar certificación</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Empleado</span>
            {hasRoster ? (
              <EmployeePicker
                employees={employees}
                value={form.employeeId}
                name={form.employeeName}
                onSelect={(e) =>
                  setForm({
                    ...form,
                    employeeId: e.id,
                    employeeName: `${e.firstName} ${e.lastName}`.trim(),
                    employeeEmail: e.email ?? '',
                    area: form.area || e.area || '',
                    station: form.station || e.station || '',
                  })
                }
                onClear={() => setForm({ ...form, employeeId: '', employeeName: '', employeeEmail: '' })}
              />
            ) : (
              <>
                <input
                  value={form.employeeName}
                  onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                  placeholder="Juan Pérez"
                  className="sk-input"
                />
                <p className="mt-1 text-[11px] text-amber-600">
                  No hay plantilla cargada. Importa empleados en RH para ligar la certificación a un empleado real.
                </p>
              </>
            )}
          </div>

          <label className="block">
            <span className="flex items-center justify-between text-[12px] font-medium text-gray-500 mb-1">
              Skill / Certificación
              <button
                type="button"
                onClick={onManageCatalog}
                className="inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                <BookOpen className="w-3 h-3" /> Catálogo
              </button>
            </span>
            <input
              list="sk-skills"
              value={form.skill}
              onChange={(e) => onSkillChange(e.target.value)}
              placeholder="IPC-A-610 / ESD / Operación SMT-1"
              className="sk-input"
            />
            <datalist id="sk-skills">
              {skillList.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <Field label="Estación">
            <input
              list="sk-stations"
              value={form.station}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
              placeholder="SMT-1"
              className="sk-input"
            />
            <datalist id="sk-stations">
              {stationOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Área">
            <input
              list="sk-areas"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="SMT"
              className="sk-input"
            />
            <datalist id="sk-areas">
              {areaOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Certificado por">
            <input
              value={form.certifiedBy}
              onChange={(e) => setForm({ ...form, certifiedBy: e.target.value })}
              placeholder="Entrenador / evaluador"
              className="sk-input"
            />
          </Field>
          <Field label="Fecha de certificación">
            <input
              type="date"
              value={form.issuedDate}
              onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
              className="sk-input"
            />
          </Field>
          <Field label="Vence">
            <input
              type="date"
              value={form.expiresDate}
              onChange={(e) => setForm({ ...form, expiresDate: e.target.value })}
              className="sk-input"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
            style={{ background: VIOLET }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Registrar
          </button>
        </div>
      </div>
    </div>
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

// ── Searchable employee picker ────────────────────────────────────────────────
function EmployeePicker({
  employees,
  value,
  name,
  onSelect,
  onClear,
}: {
  employees: Employee[];
  value: string;
  name: string;
  onSelect: (e: Employee) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? employees.filter(
          (e) =>
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
            (e.employeeNumber ?? '').toLowerCase().includes(term) ||
            (e.area ?? '').toLowerCase().includes(term),
        )
      : employees;
    return base.slice(0, 30);
  }, [employees, q]);

  if (value && name) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 text-sm font-medium">
          <UserCheck className="w-4 h-4" /> {name}
        </span>
        <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" title="Cambiar">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar empleado por nombre, número o área…"
          className="sk-input"
          style={{ paddingLeft: '2rem' }}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/95">
          {results.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onSelect(e);
                setOpen(false);
                setQ('');
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block font-medium truncate">
                  {e.firstName} {e.lastName}
                </span>
                <span className="block text-[11px] text-gray-400 truncate">
                  {[e.employeeNumber, e.area, e.station].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skill catalog manager (modal) ─────────────────────────────────────────────
function SkillCatalogModal({
  skills,
  onClose,
  onChanged,
}: {
  skills: SkillDef[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [add, setAdd] = useState({ name: '', category: '', area: '', validity: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: '', category: '', area: '', validity: '' });
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: string, body: Record<string, unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error('No se pudo guardar.', 'Catálogo');
        return false;
      }
      toast.success(ok, 'Catálogo');
      onChanged();
      return true;
    } catch {
      toast.error('Error de red.', 'Catálogo');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSkill() {
    if (add.name.trim().length < 2) {
      toast.error('Indica el nombre del skill.', 'Catálogo');
      return;
    }
    const okDone = await call(
      '/people/skills',
      'POST',
      {
        name: add.name,
        category: add.category || undefined,
        area: add.area || undefined,
        defaultValidityMonths: add.validity ? Number(add.validity) : undefined,
      },
      'Skill agregado.',
    );
    if (okDone) setAdd({ name: '', category: '', area: '', validity: '' });
  }

  async function saveEdit() {
    if (!editId) return;
    const okDone = await call(
      `/people/skills/${editId}`,
      'PATCH',
      {
        name: edit.name,
        category: edit.category,
        area: edit.area,
        defaultValidityMonths: edit.validity ? Number(edit.validity) : null,
      },
      'Skill actualizado.',
    );
    if (okDone) setEditId(null);
  }

  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-[160] grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4" style={{ color: VIOLET }} /> Catálogo de skills
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add row */}
        <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_90px_auto] gap-2 mb-4">
          <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Nombre (IPC-A-610)" className="sk-input" />
          <input value={add.category} onChange={(e) => setAdd({ ...add, category: e.target.value })} placeholder="Categoría" className="sk-input" />
          <input value={add.area} onChange={(e) => setAdd({ ...add, area: e.target.value })} placeholder="Área" className="sk-input" />
          <input value={add.validity} onChange={(e) => setAdd({ ...add, validity: e.target.value.replace(/[^0-9]/g, '') })} placeholder="meses" inputMode="numeric" className="sk-input" />
          <button onClick={addSkill} disabled={busy} className="inline-flex items-center justify-center gap-1 px-3 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Catálogo vacío. Agrega los skills/certificaciones que usa tu planta (IPC-A-610, ESD, J-STD-001…).
            </p>
          ) : (
            <div className="space-y-1.5">
              {sorted.map((s) =>
                editId === s.id ? (
                  <div key={s.id} className={`${glass} rounded-xl p-3 grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_90px] gap-2`}>
                    <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="sk-input" placeholder="Nombre" />
                    <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="sk-input" placeholder="Categoría" />
                    <input value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} className="sk-input" placeholder="Área" />
                    <input value={edit.validity} onChange={(e) => setEdit({ ...edit, validity: e.target.value.replace(/[^0-9]/g, '') })} className="sk-input" placeholder="meses" inputMode="numeric" />
                    <div className="col-span-full flex justify-end gap-2">
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 rounded-lg text-[12px] hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                      <button onClick={saveEdit} disabled={busy} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>Guardar</button>
                    </div>
                  </div>
                ) : (
                  <div key={s.id} className={`${glass} rounded-xl p-3 flex items-center gap-3 ${s.active ? '' : 'opacity-50'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {s.name}
                        {!s.active && <span className="ml-2 text-[10px] text-gray-400">archivado</span>}
                      </div>
                      <div className="text-[12px] text-gray-400 truncate">
                        {[s.category, s.area, s.defaultValidityMonths != null ? `${s.defaultValidityMonths}m vigencia` : null]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditId(s.id);
                        setEdit({ name: s.name, category: s.category ?? '', area: s.area ?? '', validity: s.defaultValidityMonths != null ? String(s.defaultValidityMonths) : '' });
                      }}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => call(`/people/skills/${s.id}`, 'PATCH', { active: !s.active }, s.active ? 'Skill archivado.' : 'Skill restaurado.')}
                      disabled={busy}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      title={s.active ? 'Archivar' : 'Restaurar'}
                    >
                      {s.active ? <Archive className="w-4 h-4 text-gray-400" /> : <RefreshCw className="w-4 h-4" style={{ color: GREEN }} />}
                    </button>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
