'use client';

import React, { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Users, UserPlus, Shield, Building2, Search, CheckCircle2, XCircle,
  ShieldCheck, Factory, ChevronLeft, X, Loader2, KeyRound, Pencil, Power,
  Lock, Crown, Info,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useDialogA11y } from '@/hooks/useDialogA11y';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_OPTIONS, roleLabel, roleMeta, TONES, permissionsForRole } from '../_lib/rbac';
import { protectionFor, type Protection } from '../_lib/access';
import SettingsTabs from '../_components/SettingsTabs';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface BackendUser {
  id: string; email: string; username?: string; name?: string | null; role?: string;
  isActive?: boolean; status?: string; tenantId?: string | null; createdAt?: string;
  lastLoginAt?: string | null; position?: string | null; scopes?: Record<string, unknown> | null;
}

// Role labels/permissions come from the shared RBAC mirror (../_lib/rbac), the
// single source of truth shared with the Matriz de permisos page.
const ROLE_ICON: Record<string, React.ElementType> = { admin: Crown, executive: Building2, plant_manager: Factory };
const roleIconFor = (r?: string) => ROLE_ICON[(r || '').toLowerCase()] ?? ShieldCheck;
const roleTone = (r?: string) => TONES[roleMeta(r)?.tone ?? 'slate'];

export default function UsersManagementPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const meEmail = me?.email ?? null;
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
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-[#1D1D1F] dark:hover:text-white transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-medium mb-2"><Shield className="w-4 h-4" /><span className="text-sm tracking-wide uppercase">Administración</span></div>
            <h1 className="text-4xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">Usuarios y roles</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">Crea usuarios, asigna rol y scope (planta/línea), activa/desactiva y resetea contraseñas. Mira lo que otorga cada rol en la matriz de permisos.</p>
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
        <div className="mt-6"><SettingsTabs /></div>
      </div>

      {/* Real stats */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
        {[
          { label: 'Usuarios', value: users.length, icon: Users, color: 'text-blue-600' },
          { label: 'Activos', value: activeCount, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Inactivos', value: users.length - activeCount, icon: XCircle, color: 'text-slate-400' },
          { label: 'Administradores', value: users.filter((u) => (u.role || '').toLowerCase() === 'admin').length, icon: ShieldCheck, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm">
            <div className={`p-2 rounded-xl bg-slate-50 dark:bg-white/10 inline-flex ${s.color} mb-3`}><s.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-semibold text-[#1D1D1F] dark:text-white">{s.value}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Honest backend-capability note */}
      <div className="max-w-7xl mx-auto mb-8 flex items-start gap-3 p-4 rounded-2xl bg-[#F5F5F7]/70 dark:bg-white/5 border border-[#F2F2F7] dark:border-white/10">
        <Info className="w-5 h-5 text-[#86868B] shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <strong className="text-[#1D1D1F] dark:text-white">Sobre estas acciones (solo endpoints existentes):</strong>{' '}
          “Crear usuario” da de alta la cuenta directamente vía <code className="px-1 py-0.5 rounded bg-white dark:bg-white/10">POST /governance/users</code> y compartes las
          credenciales — aún no hay invitación por correo (falta endpoint de invitación en backend). Quien se registra solo queda pendiente y se aprueba en{' '}
          <Link href="/dashboard/admin/approvals" className="underline">Aprobaciones</Link>. “Desactivar” es un apagado suave (<code className="px-1 py-0.5 rounded bg-white dark:bg-white/10">isActive:false</code>);
          no hay borrado definitivo por API. La cuenta <strong>Master / Dueño</strong> está protegida y no puede degradarse ni desactivarse aquí.
        </div>
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
              <tr className="bg-[#FBFBFD] dark:bg-white/5 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-widest font-semibold">
                <th className="px-6 py-4">Usuario</th><th className="px-6 py-4">Rol</th><th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4">Estado</th><th className="px-6 py-4">Último acceso</th><th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F7] dark:divide-white/10">
              <AnimatePresence mode="popLayout">
                {filtered.map((u) => {
                  const rs = roleTone(u.role);
                  const RoleIcon = roleIconFor(u.role);
                  const active = u.isActive ?? u.status === 'active';
                  const scopes = (u.scopes || {}) as { buildings?: string[]; lines?: number[] };
                  const prot = protectionFor(u, meEmail);
                  return (
                    <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={u.id} className="hover:bg-[#F5F5F7]/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">{(u.name || u.email || '?')[0]?.toUpperCase()}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#1D1D1F] dark:text-white flex items-center gap-1.5">
                              {u.name || u.username || u.email?.split('@')[0]}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${rs.chip} ${rs.text}`}><RoleIcon className="w-3.5 h-3.5" />{roleLabel(u.role)}</span>
                          {prot.locked && (
                            <span title={prot.note} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              {prot.reason === 'owner' ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{prot.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">{scopes.buildings?.length ? `Edif: ${scopes.buildings.join(', ')}` : 'Global'}{scopes.lines?.length ? ` · L${scopes.lines.join(',')}` : ''}</td>
                      <td className="px-6 py-4">{active ? <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span> : <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Inactivo</span>}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEdit(u)} title={prot.locked ? 'Editar (rol protegido)' : 'Editar'} className="p-2 text-[#86868B] hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"><Pencil className="w-4 h-4" /></button>
                          {prot.locked ? (
                            <span title={prot.note} className="p-2 text-[#C7C7CC] dark:text-white/25 cursor-not-allowed inline-flex"><Lock className="w-4 h-4" /></span>
                          ) : (
                            <button onClick={() => patchUser(u.id, active ? { isActive: false } : { isActive: true, status: 'active' }, active ? 'Usuario desactivado.' : 'Usuario activado.')} disabled={busy} title={active ? 'Desactivar' : 'Activar'} className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${active ? 'text-[#86868B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-[#86868B] hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}><Power className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && !loading && <div className="p-16 text-center"><Search className="w-8 h-8 text-slate-300 mx-auto mb-3" /><h3 className="text-lg font-medium text-[#1D1D1F] dark:text-white">Sin usuarios</h3><p className="text-gray-600 dark:text-gray-400 mt-1">Ajusta la búsqueda o crea uno nuevo.</p></div>}
        {loading && <div className="p-16 text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" /><p className="text-gray-600 dark:text-gray-400 mt-3">Cargando usuarios…</p></div>}
      </div>

      {edit && (
        <EditDrawer
          user={edit}
          busy={busy}
          protection={protectionFor(edit, meEmail)}
          onClose={() => setEdit(null)}
          onSave={async (body) => { if (await patchUser(edit.id, body, 'Cambios guardados.')) setEdit(null); }}
          onReset={async (pw) => { await patchUser(edit.id, { password: pw }, 'Contraseña restablecida.'); }}
        />
      )}
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
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <motion.div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-white dark:bg-[#111] rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-[#F2F2F7] dark:border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 id={titleId} className="text-lg font-semibold text-[#1D1D1F] dark:text-white">{title}</h3><button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </motion.div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full rounded-xl px-3 py-2.5 bg-[#F5F5F7] dark:bg-white/10 border border-transparent focus:border-blue-400 outline-none text-sm dark:text-white disabled:opacity-60 disabled:cursor-not-allowed';

/** Live preview of what a role grants — ties role assignment to the Matriz. */
function RolePermsPreview({ role }: { role: string }) {
  const isAdmin = (role || '').toLowerCase() === 'admin';
  const perms = permissionsForRole(role);
  return (
    <div className="rounded-xl bg-[#F5F5F7] dark:bg-white/5 p-3 border border-[#F2F2F7] dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Permisos del rol</span>
        <span className={`text-[11px] font-semibold ${isAdmin ? 'text-purple-600' : 'text-[#1D1D1F] dark:text-white'}`}>{isAdmin ? 'Acceso total' : `${perms.length} permiso${perms.length === 1 ? '' : 's'}`}</span>
      </div>
      {isAdmin ? (
        <p className="text-xs text-gray-600 dark:text-gray-400">Omite el guard de permisos: puede ver y hacer todo.</p>
      ) : perms.length === 0 ? (
        <p className="text-xs text-[#86868B]">Este rol no otorga permisos.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {perms.slice(0, 14).map((p) => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-white/10 text-[#1D1D1F] dark:text-white/80 border border-[#F2F2F7] dark:border-white/10">{p}</span>
          ))}
          {perms.length > 14 && <span className="text-[10px] px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">+{perms.length - 14}</span>}
        </div>
      )}
      <Link href="/dashboard/settings/permissions" className="text-[11px] text-blue-600 hover:underline mt-2 inline-block">Ver matriz completa →</Link>
    </div>
  );
}

function EditDrawer({ user, busy, protection, onClose, onSave, onReset }: { user: BackendUser; busy: boolean; protection: Protection; onClose: () => void; onSave: (b: Record<string, unknown>) => void; onReset: (pw: string) => void; }) {
  const scopes = (user.scopes || {}) as { buildings?: string[]; lines?: number[] };
  const [role, setRole] = useState((user.role || 'operator').toLowerCase());
  const [building, setBuilding] = useState(scopes.buildings?.[0] || '');
  const [line, setLine] = useState(scopes.lines?.[0] ? String(scopes.lines[0]) : '');
  const [name, setName] = useState(user.name || '');
  const [pw, setPw] = useState('');
  const lockRole = protection.locked;
  function save() {
    const newScopes: Record<string, unknown> = {};
    if (building.trim()) newScopes.buildings = [building.trim()];
    if (line.trim()) { const n = Number(line); if (!Number.isNaN(n)) newScopes.lines = [n]; }
    const body: Record<string, unknown> = { name: name.trim() || undefined, scopes: newScopes, tenantId: building.trim() || undefined };
    if (!lockRole) body.role = role; // never degrade a protected (Master/owner/self) account
    onSave(body);
  }
  return (
    <Modal title={`Editar · ${user.email}`} onClose={onClose}>
      <div className="space-y-4">
        {lockRole && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
            {protection.reason === 'owner' ? <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> : <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
            <div className="text-xs text-amber-800 dark:text-amber-200"><strong>{protection.label}.</strong> {protection.note}</div>
          </div>
        )}
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label={lockRole ? 'Rol (protegido)' : 'Rol'}>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={lockRole} className={inputCls}>{ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        </Field>
        <RolePermsPreview role={role} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edificio / planta (scope)"><input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="(global si vacío)" className={inputCls} /></Field>
          <Field label="Línea (scope)"><input value={line} onChange={(e) => setLine(e.target.value)} placeholder="ej. 3" className={inputCls} /></Field>
        </div>
        <button onClick={save} disabled={busy} className="w-full py-3 rounded-xl bg-[#1D1D1F] dark:bg-white text-white dark:text-black font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar cambios</button>
        <div className="pt-4 border-t border-[#F2F2F7] dark:border-white/10">
          <Field label="Restablecer contraseña"><div className="flex gap-2"><input value={pw} onChange={(e) => setPw(e.target.value)} type="text" placeholder="Nueva contraseña (≥6)" className={inputCls} /><button onClick={() => { if (pw.trim().length < 6) return; onReset(pw.trim()); setPw(''); }} disabled={busy || pw.trim().length < 6} className="px-3 rounded-xl bg-amber-700 text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"><KeyRound className="w-4 h-4" /> Resetear</button></div></Field>
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
        <RolePermsPreview role={form.role} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Edificio / planta"><input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="(opcional)" className={inputCls} /></Field>
          <Field label="Línea"><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} placeholder="(opcional)" className={inputCls} /></Field>
        </div>
        <button onClick={submit} disabled={busy || !form.email.trim() || form.password.length < 6} className="w-full py-3 rounded-xl bg-[#1D1D1F] dark:bg-white text-white dark:text-black font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Crear usuario</button>
      </div>
    </Modal>
  );
}
