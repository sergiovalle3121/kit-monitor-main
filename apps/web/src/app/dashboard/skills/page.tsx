'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  GraduationCap,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type CertStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NO_EXPIRY';

interface Cert {
  id: string;
  folio: string | null;
  employeeName: string;
  skill: string;
  area?: string | null;
  station?: string | null;
  status: CertStatus;
  daysToExpiry: number | null;
  expiresDate?: string | null;
  active: boolean;
}

interface Kpis {
  total: number;
  valid: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  employees: number;
  skills: number;
  coverage: { skill: string; count: number }[];
}

const STATUS_META: Record<CertStatus, { label: string; color: string }> = {
  VALID: { label: 'Vigente', color: GREEN },
  EXPIRING: { label: 'Por vencer', color: AMBER },
  EXPIRED: { label: 'Vencida', color: RED },
  NO_EXPIRY: { label: 'Sin vencimiento', color: GRAY },
};

export default function SkillsPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Cert[]>('/people/certifications');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/people/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeName: '',
    skill: '',
    area: '',
    station: '',
    expiresDate: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createCert() {
    if (form.employeeName.trim().length < 2 || form.skill.trim().length < 2) {
      toast.error('Indica empleado y skill.', 'Skills');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/people/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expiresDate: form.expiresDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo registrar.', 'Skills');
        return;
      }
      toast.success('Certificación registrada.', 'Skills');
      setShowForm(false);
      setForm({ employeeName: '', skill: '', area: '', station: '', expiresDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Skills');
    } finally {
      setBusy(false);
    }
  }

  async function recertify(c: Cert) {
    const nd = window.prompt('Nueva fecha de expiración (YYYY-MM-DD):', '');
    if (!nd) return;
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/people/certifications/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresDate: nd, active: true }),
      });
      if (!res.ok) { toast.error('No se pudo recertificar.', 'Skills'); return; }
      toast.success('Recertificado.', 'Skills');
      refresh();
    } catch {
      toast.error('Error de red.', 'Skills');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver skills.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <GraduationCap className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">RH · Skills y Certificaciones</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Matriz de habilidades y alertas de recertificación</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Certificar
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Certificaciones vigentes" value={kpis?.valid ?? 0} sub={`${kpis?.employees ?? 0} empleados · ${kpis?.skills ?? 0} skills`} color={GREEN} />
          <Kpi label="Por vencer (30d)" value={kpis?.expiring30 ?? 0} sub={`${(kpis?.expiring60 ?? 0) + (kpis?.expiring90 ?? 0)} en 60-90d`} color={AMBER} />
          <Kpi label="Vencidas" value={kpis?.expired ?? 0} color={(kpis?.expired ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Skills cubiertos" value={kpis?.skills ?? 0} color={VIOLET} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Registrar certificación</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Empleado</span>
                <input value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} placeholder="Juan Pérez" className="sk-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Skill / Certificación</span>
                <input value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} placeholder="IPC-A-610 / ESD / Operación SMT-1" className="sk-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className="sk-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Estación</span>
                <input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} placeholder="SMT-1" className="sk-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vence</span>
                <input type="date" value={form.expiresDate} onChange={(e) => setForm({ ...form, expiresDate: e.target.value })} className="sk-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createCert} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Registrar
              </button>
            </div>
          </div>
        )}

        {/* Coverage */}
        {kpis && kpis.coverage.length > 0 && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <h3 className="font-semibold mb-3">Cobertura por skill</h3>
            <div className="flex flex-wrap gap-2">
              {kpis.coverage.map((s) => (
                <span key={s.skill} className="text-[12px] px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10">
                  {s.skill} <span className="text-gray-400">· {s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin certificaciones registradas</h3>
            <p className="text-sm text-gray-400 mt-1">Registra skills para saber quién puede operar cada estación.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <div key={c.id} className={`${glass} rounded-xl p-4 flex items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{c.employeeName}</span>
                    <span className="text-[12px] text-gray-400">·</span>
                    <span className="text-[13px] truncate">{c.skill}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${STATUS_META[c.status].color}1f`, color: STATUS_META[c.status].color }}>
                      {STATUS_META[c.status].label}{c.status === 'EXPIRING' && c.daysToExpiry !== null ? ` · ${c.daysToExpiry}d` : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-gray-400">
                    {c.area && <span>{c.area}</span>}{c.station && <span> · {c.station}</span>}
                    {c.expiresDate && <span> · vence {new Date(c.expiresDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                {(c.status === 'EXPIRING' || c.status === 'EXPIRED') && (
                  <button onClick={() => recertify(c)} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN }}>
                    Recertificar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

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
        .sk-input:focus { border-color: #7c3aed; }
        :global(.dark) .sk-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
