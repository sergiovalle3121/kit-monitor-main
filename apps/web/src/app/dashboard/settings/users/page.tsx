'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Users, UserPlus, Shield, Building2, Search, CheckCircle2, XCircle,
  ShieldCheck, Factory, ChevronLeft, X, Loader2, KeyRound, Pencil, Power,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface BackendUser {
  id: string; email: string; username?: string; name?: string | null; role?: string;
  isActive?: boolean; status?: string; tenantId?: string | null; createdAt?: string;
  lastLoginAt?: string | null; position?: string | null; scopes?: Record<string, unknown> | null;
}

// Role catalog (mirrors auth/rbac.ts). Value = stored role; label = human.
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador (acceso total)' },
  { value: 'executive', label: 'Dirección / Ejecutivo' },
  { value: 'plant_manager', label: 'Gerente de planta' },
  { value: 'planner', label: 'Planeación' },
  { value: 'warehouse_operator', label: 'Almacén' },
  { value: 'materialist', label: 'Materialista / Surtidor' },
  { value: 'production_supervisor', label: 'Supervisor de producción' },
  { value: 'operator', label: 'Operador de línea' },
  { value: 'quality_engineer', label: 'Ingeniero de calidad' },
  { value: 'mrb_member', label: 'Miembro MRB' },
  { value: 'engineering', label: 'Ingeniería' },
  { value: 'industrial_engineer', label: 'Ingeniero industrial' },
  { value: 'cycle_count_analyst', label: 'Analista de conteos' },
  { value: 'maintenance_tech', label: 'Mantenimiento' },
  { value: 'buyer', label: 'Compras' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'hr', label: 'Recursos Humanos' },
];
const ROLE_LABEL = (r?: string) =>
  ROLE_OPTIONS.find((o) => o.value === (r || '').toLowerCase())?.label || r || '—';

const ROLE_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  Admin: { bg: 'bg-purple-50', text: 'text-purple-700', icon: ShieldCheck },
  admin: { bg: 'bg-purple-50', text: 'text-purple-700', icon: ShieldCheck },
  plant_manager: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Factory },
  executive: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Building2 },
};
const roleStyleFor = (r?: string) => ROLE_COLORS[r || ''] || { bg: 'bg-slate-100', text: 'text-slate-700', icon: Users };

export default function UsersManagementPage() {
  const toast = useToast();
  const { data: rawUsers, isLoading: loading, mutate } = useApi<BackendUser[]>('/governance/users');
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<BackendUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = users.filter((u) =>
    [u.email, u.username, u.name].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()),
  );
  const activeCount = users.filter((u) => u.isActive ?? u.status === 'active').length;

  async function patchUser(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/governance/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo guardar.', 'Usuarios'); return false; }
      toast.success(okMsg, 'Usuarios'); mutate(); return true;
    } catch { toast.error('Error de red.', 'Usuarios'); return false; }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-black p-6 md:p-8">
      <div className="max-w-7xl mx-auto mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-medium mb-2"><Shield className="w-4 h-4" /><span className="text-sm tracking-wide uppercase">Administración</span></div>
            <h1 className="text-4xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">Usuarios y accesos</h1>
            <p className="text-[#86868B] mt-2 text-lg">Crea usuarios, asigna rol y scope (planta/línea), activa/desactiva y resetea contraseñas.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/approvals" className="flex items-center gap-2 bg-white dark:bg-white/10 text-[#1D1D1F] dark:text-white border border-[#F2F2F7] dark:border-white/10 px-5 py-3 rounded-full font-medium hover:scale-[1.02] active:scale-95 transition-all">
              <CheckCircle2 className="w-5 h-5" /> Aprobaciones
            </Link>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[#1D1D1F] dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-medium shadow-lg shadow-black/5 hover:scale-[1.02] active:scale-95 transition-all">
              <UserPlus className="w-5 h-5" /> Crear usuario
            </button>
          </div>
        </div>
      </div>

      {/* Real stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { label: 'Usuarios', value: users.length, icon: Users, color: 'text-blue-600' },
          { label: 'Activos', value: activeCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inactivos', value: users.length - activeCount, icon: XCircle, color: 'text-slate-400' },
          { label: 'Administradores', value: users.filter((u) => (u.role || '').toLowerCase() === 'admin').length, icon: ShieldCheck, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm">
            <div className={`p-2 rounded-xl bg-slate-50 dark:bg-white/10 inline-flex ${s.color} mb-3`}><s.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-semibold text-[#1D1D1F] dark:text-white">{s.value}</div>
            <div className="text-sm text-[#86868B] font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto bg-white dark:bg-white/5 rounded-[32px] border border-[#F2F2F7] dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#F2F2F7] dark:border-white/10">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o usuario…" className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] dark:bg-white/10 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all dark:text-white" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFBFD] dark:bg-white/5 text-[#86868B] text-xs uppercase tracking-widest font-semibold">
                <th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Rol</th><th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4">Estado</th><th className="px-6 py-4">Último acceso</th><th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7] dark:divide-white/10">
              <AnimatePresence mode="popLayout">
                {filtered.map((u) => {
                  const rs = roleStyleFor(u.role);
                  const active = u.isActive ?? u.status === 'active';
                  const scopes = (u.scopes || {}) as { buildings?: string[]; lines?: number[] };
                  return (
                    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={u.id} className="hover:bg-[#F5F5F7]/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">{(u.name || u.email || '?')[0]?.toUpperCase()}</div>
                          <div><div className="text-sm font-medium text-[#1D1D1F] dark:text-white">{u.name || u.username || u.email?.split('@')[0]}</div><div className="text-xs text-[#86868B]">{u.email}</div></div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${rs.bg} ${rs.text}`}><rs.icon className="w-3.5 h-3.5" />{ROLE_LABEL(u.role)}</span></td>
                      <td className="px-6 py-4 text-xs text-[#86868B]">{scopes.buildings?.length ? `Edif: ${scopes.buildings.join(', ')}` : 'Global'}{scopes.lines?.length ? ` · L${scopes.lines.join(',')}` : ''}</td>
                      <td className="px-6 py-4">{active ? <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span> : <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Inactivo</span>}</td>
                      <td className="px-6 py-4 text-xs text-[#86868B]">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEdit(u)} title="Editar" className="p-2 text-[#86868B] hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => patchUser(u.id, active ? { isActive: false } : { isActive: true, status: 'active' }, active ? 'Usuario desactivado.' : 'Usuario activado.')} title={active ? 'Desactivar' : 'Activar'} className={`p-2 rounded-lg transition-colors ${active ? 'text-[#86868B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-[#86868B] hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}><Power className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && !loading && <div className="p-16 text-center"><Search className="w-8 h-8 text-slate-300 mx-auto mb-3" /><h3 className="text-lg font-medium text-[#1D1D1F] dark:text-white">Sin usuarios</h3><p className="text-[#86868B] mt-1">Ajusta la búsqueda o crea uno nuevo.</p></div>}
        {loading && <div className="p-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" /><p className="text-[#86868B] mt-3">Cargando usuarios…</p></div>}
      </div>

      {edit && <EditDrawer user={edit} busy={busy} onClose={() => setEdit(null)} onSave={async (body) => { if (await patchUser(edit.id, body, 'Cambios guardados.')) setEdit(null); }} onReset={async (pw) => { await patchUser(edit.id, { password: pw }, 'Contraseña restablecida.'); }} />}
      {showCreate && <CreateModal busy={busy} onClose={() => setShowCreate(false)} onCreate={async (body) => {
        setBusy(true);
        try {
          const res = await apiFetch(`${API_BASE}/governance/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo crear.', 'Usuarios'); return; }
          toast.success('Usuario creado.', 'Usuarios'); setShowCreate(false); mutate();
        } catch { toast.error('Error de red.', 'Usuarios'); } finally { setBusy(false); }
      }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-[#F2F2F7] dark:border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-white">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </motion.div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-[#86868B] mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full rounded-xl px-3 py-2.5 bg-[#F5F5F7] dark:bg-white/10 border border-transparent focus:border-blue-400 outline-none text-sm dark:text-white';

function EditDrawer({ user, busy, onClose, onSave, onReset }: { user: BackendUser; busy: boolean; onClose: () => void; onSave: (b: Record<string, unknown>) => void; onReset: (pw: string) => void; }) {
  const scopes = (user.scopes || {}) as { buildings?: string[]; lines?: number[] };
  const [role, setRole] = useState((user.role || 'operator').toLowerCase());
  const [building, setBuilding] = useState(scopes.buildings?.[0] || '');
  const [line, setLine] = useState(scopes.lines?.[0] ? String(scopes.lines[0]) : '');
  const [name, setName] = useState(user.name || '');
  const [pw, setPw] = useState('');
  function save() {
    const newScopes: Record<string, unknown> = {};
    if (building.trim()) newScopes.buildings = [building.trim()];
    if (line.trim()) { const n = Number(line); if (!Number.isNaN(n)) newScopes.lines = [n]; }
    onSave({ role, name: name.trim() || undefined, scopes: newScopes, tenantId: building.trim() || undefined });
  }
  return (
    <Modal title={`Editar · ${user.email}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Rol"><select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edificio / planta (scope)"><input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="(global si vacío)" className={inputCls} /></Field>
          <Field label="Línea (scope)"><input value={line} onChange={(e) => setLine(e.target.value)} placeholder="ej. 3" className={inputCls} /></Field>
        </div>
        <button onClick={save} disabled={busy} className="w-full py-3 rounded-xl bg-[#1D1D1F] dark:bg-white text-white dark:text-black font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar cambios</button>
        <div className="pt-4 border-t border-[#F2F2F7] dark:border-white/10">
          <Field label="Restablecer contraseña"><div className="flex gap-2"><input value={pw} onChange={(e) => setPw(e.target.value)} type="text" placeholder="Nueva contraseña (≥6)" className={inputCls} /><button onClick={() => { if (pw.trim().length < 6) return; onReset(pw.trim()); setPw(''); }} disabled={busy || pw.trim().length < 6} className="px-3 rounded-xl bg-amber-500 text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"><KeyRound className="w-4 h-4" /> Resetear</button></div></Field>
        </div>
      </div>
    </Modal>
  );
}

function CreateModal({ busy, onClose, onCreate }: { busy: boolean; onClose: () => void; onCreate: (b: Record<string, unknown>) => void; }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator', building: '', line: '' });
  function submit() {
    if (!form.email.trim() || form.password.length < 6) return;
    onCreate({ name: form.name.trim() || undefined, email: form.email.trim(), password: form.password, role: form.role, buildingId: form.building.trim() || undefined, line: form.line.trim() || undefined });
  }
  return (
    <Modal title="Crear usuario" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Correo"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className={inputCls} /></Field>
        </div>
        <Field label="Contraseña (≥6)"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="text" className={inputCls} /></Field>
        <Field label="Rol"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edificio / planta"><input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="(opcional)" className={inputCls} /></Field>
          <Field label="Línea"><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} placeholder="(opcional)" className={inputCls} /></Field>
        </div>
        <button onClick={submit} disabled={busy || !form.email.trim() || form.password.length < 6} className="w-full py-3 rounded-xl bg-[#1D1D1F] dark:bg-white text-white dark:text-black font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Crear usuario</button>
      </div>
    </Modal>
  );
}
