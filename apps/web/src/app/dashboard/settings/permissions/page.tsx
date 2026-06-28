'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Shield, Search, Check, Info, LayoutGrid, Rows3,
  Crown, Filter, X, Users,
} from 'lucide-react';
import {
  ROLE_META, permissionsForRole, roleHasPermission, PERMISSION_GROUPS, TONES,
  TOTAL_PERMISSIONS, TOTAL_RESOURCES, type RoleMeta,
} from '../_lib/rbac';
import SettingsTabs from '../_components/SettingsTabs';

type View = 'cards' | 'grid';

export default function PermissionsMatrixPage() {
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('cards');
  const [resourceFilter, setResourceFilter] = useState<Set<string>>(new Set());
  const [roleFocus, setRoleFocus] = useState<string>('all');
  const [onlyGranted, setOnlyGranted] = useState(true);

  const ql = q.trim().toLowerCase();

  // Columns (permissions) narrowed by the resource chips + the text search.
  const visibleGroups = useMemo(() => {
    return PERMISSION_GROUPS
      .filter((g) => resourceFilter.size === 0 || resourceFilter.has(g.resource))
      .map((g) => ({
        ...g,
        perms: g.perms.filter((p) =>
          !ql ||
          p.id.includes(ql) ||
          p.action.includes(ql) ||
          p.actionLabel.toLowerCase().includes(ql) ||
          g.label.toLowerCase().includes(ql),
        ),
      }))
      .filter((g) => g.perms.length > 0);
  }, [ql, resourceFilter]);

  const visibleRoles = useMemo(
    () => (roleFocus === 'all' ? ROLE_META : ROLE_META.filter((r) => r.value === roleFocus)),
    [roleFocus],
  );

  const flatCols = useMemo(
    () => visibleGroups.flatMap((g) => g.perms.map((p) => ({ ...p, resource: g.resource, tone: g.tone }))),
    [visibleGroups],
  );

  const toggleResource = (r: string) =>
    setResourceFilter((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  const hasFilters = ql.length > 0 || resourceFilter.size > 0 || roleFocus !== 'all';
  const clearFilters = () => { setQ(''); setResourceFilter(new Set()); setRoleFocus('all'); };

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-black p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
          <Shield className="w-4 h-4" /><span className="text-sm tracking-wide uppercase">Administración</span>
        </div>
        <h1 className="text-4xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">Matriz de permisos</h1>
        <p className="text-[#86868B] mt-2 text-lg max-w-3xl">
          Solo lectura. Muestra qué <code className="px-1.5 py-0.5 rounded bg-[#F2F2F7] dark:bg-white/10 text-sm">resource:action</code> otorga
          cada rol del catálogo RBAC, para que sea transparente quién puede qué.
        </p>

        <div className="mt-6"><SettingsTabs /></div>

        {/* Why this exists */}
        <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-[#1D1D1F] dark:text-blue-100/90 leading-relaxed">
            Esta matriz vuelve visible lo que antes era opaco: si un usuario quedó en <strong>solo lectura</strong>, aquí
            se ve exactamente qué permisos trae su rol. Asignas el rol en <Link href="/dashboard/settings/users" className="underline font-medium">Usuarios y roles</Link>; el
            backend convierte ese rol en estos permisos (su JWT los lleva en el siguiente inicio de sesión).
            El rol <strong>Admin / Master</strong> omite el guard: tiene acceso total.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 md:gap-6">
          {[
            { label: 'Roles', value: ROLE_META.length, icon: Users, tone: 'text-blue-600' },
            { label: 'Permisos', value: TOTAL_PERMISSIONS, icon: ShieldCheck, tone: 'text-purple-600' },
            { label: 'Recursos', value: TOTAL_RESOURCES, icon: LayoutGrid, tone: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-white/5 p-5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm">
              <div className={`p-2 rounded-xl bg-slate-50 dark:bg-white/10 inline-flex ${s.tone} mb-3`}><s.icon className="w-5 h-5" /></div>
              <div className="text-2xl font-semibold text-[#1D1D1F] dark:text-white">{s.value}</div>
              <div className="text-sm text-[#86868B] font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="mt-6 bg-white dark:bg-white/5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm p-4 md:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar permiso (p. ej. quality:hold, surtir, planeación)…"
                className="w-full pl-11 pr-4 py-3 bg-[#F5F5F7] dark:bg-white/10 rounded-2xl border-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFocus}
                onChange={(e) => setRoleFocus(e.target.value)}
                className="px-3 py-3 bg-[#F5F5F7] dark:bg-white/10 rounded-2xl border-none text-sm dark:text-white focus:ring-2 focus:ring-blue-500/20"
                aria-label="Enfocar rol"
              >
                <option value="all">Todos los roles</option>
                {ROLE_META.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div className="inline-flex p-1 rounded-2xl bg-[#F5F5F7] dark:bg-white/10">
                <button onClick={() => setView('cards')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${view === 'cards' ? 'bg-white dark:bg-white/15 text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#86868B]'}`}><Rows3 className="w-4 h-4" />Tarjetas</button>
                <button onClick={() => setView('grid')} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${view === 'grid' ? 'bg-white dark:bg-white/15 text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#86868B]'}`}><LayoutGrid className="w-4 h-4" />Cuadrícula</button>
              </div>
            </div>
          </div>

          {/* Resource chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#86868B] uppercase tracking-wider mr-1"><Filter className="w-3.5 h-3.5" />Recursos</span>
            {PERMISSION_GROUPS.map((g) => {
              const on = resourceFilter.has(g.resource);
              const tone = TONES[g.tone];
              return (
                <button
                  key={g.resource}
                  onClick={() => toggleResource(g.resource)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${on ? `${tone.chip} ${tone.text} border-transparent` : 'bg-white dark:bg-white/5 text-[#86868B] border-[#F2F2F7] dark:border-white/10 hover:text-[#1D1D1F] dark:hover:text-white'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                  {g.label}
                </button>
              );
            })}
            {view === 'cards' && (
              <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-[#86868B] cursor-pointer select-none">
                <input type="checkbox" checked={onlyGranted} onChange={(e) => setOnlyGranted(e.target.checked)} className="rounded accent-blue-600" />
                Solo recursos con acceso
              </label>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#86868B] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mt-6">
          {visibleGroups.length === 0 ? (
            <div className="bg-white dark:bg-white/5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 p-16 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-[#1D1D1F] dark:text-white">Sin permisos que coincidan</h3>
              <p className="text-[#86868B] mt-1">Ajusta la búsqueda o los filtros de recurso.</p>
            </div>
          ) : view === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleRoles.map((role) => (
                <RoleCard key={role.value} role={role} groups={visibleGroups} onlyGranted={onlyGranted} />
              ))}
            </div>
          ) : (
            <MatrixGrid roles={visibleRoles} groups={visibleGroups} cols={flatCols} />
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-xs text-[#86868B] max-w-3xl">
          Refleja el catálogo RBAC del backend (<code className="px-1 py-0.5 rounded bg-[#F2F2F7] dark:bg-white/10">auth/rbac.ts</code>).
          La asignación de rol por usuario se hace en <Link href="/dashboard/settings/users" className="underline">Usuarios y roles</Link>.
          Editar la matriz misma (qué otorga cada rol) es una tarea de backend.
        </p>
      </div>
    </div>
  );
}

/** One role → its grants, grouped by resource. */
function RoleCard({
  role, groups, onlyGranted,
}: {
  role: RoleMeta;
  groups: typeof PERMISSION_GROUPS;
  onlyGranted: boolean;
}) {
  const tone = TONES[role.tone];
  const isAdmin = role.value === 'admin';
  const granted = useMemo(() => new Set(permissionsForRole(role.value)), [role.value]);
  const totalGranted = permissionsForRole(role.value).length;

  const sections = groups
    .map((g) => ({ ...g, hit: g.perms.filter((p) => granted.has(p.id)) }))
    .filter((g) => !onlyGranted || isAdmin || g.hit.length > 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-white/5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm overflow-hidden flex flex-col"
    >
      <div className="p-5 border-b border-[#F2F2F7] dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-2xl ${tone.chip} ${tone.text} inline-flex items-center justify-center shrink-0`}>
              {isAdmin ? <Crown className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white truncate">{role.label}</div>
              <div className="text-xs text-[#86868B]">{role.group}</div>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isAdmin ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300' : 'bg-[#F5F5F7] dark:bg-white/10 text-[#1D1D1F] dark:text-white'}`}>
            {isAdmin ? 'Acceso total' : `${totalGranted} permiso${totalGranted === 1 ? '' : 's'}`}
          </span>
        </div>
        <p className="text-xs text-[#86868B] mt-2.5 leading-relaxed">{role.description}</p>
      </div>

      <div className="p-5 space-y-3 flex-1">
        {sections.length === 0 ? (
          <div className="text-xs text-[#86868B] italic">Sin permisos en los recursos visibles.</div>
        ) : (
          sections.map((g) => {
            const gTone = TONES[g.tone];
            return (
              <div key={g.resource}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${gTone.dot}`} />
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-white">{g.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.perms.map((p) => {
                    const has = granted.has(p.id);
                    if (onlyGranted && !has && !isAdmin) return null;
                    return (
                      <span
                        key={p.id}
                        title={p.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          has || isAdmin
                            ? `${gTone.chip} ${gTone.text}`
                            : 'bg-[#F5F5F7] dark:bg-white/5 text-[#C7C7CC] dark:text-white/30 line-through'
                        }`}
                      >
                        {(has || isAdmin) && <Check className="w-3 h-3" />}
                        {p.actionLabel}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

/** Roles × permissions grid (the literal matrix). */
function MatrixGrid({
  roles, groups, cols,
}: {
  roles: RoleMeta[];
  groups: typeof PERMISSION_GROUPS;
  cols: { id: string; action: string; actionLabel: string; resource: string; tone: keyof typeof TONES }[];
}) {
  return (
    <div className="bg-white dark:bg-white/5 rounded-3xl border border-[#F2F2F7] dark:border-white/10 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-20 bg-[#FBFBFD] dark:bg-[#0a0a0a] px-4 py-3 text-left align-bottom border-b border-r border-[#F2F2F7] dark:border-white/10 min-w-[200px]">
                <span className="text-xs uppercase tracking-widest font-semibold text-[#86868B]">Rol \ Permiso</span>
              </th>
              {groups.map((g) => {
                const tone = TONES[g.tone];
                return (
                  <th key={g.resource} colSpan={g.perms.length} className={`px-2 py-2 text-center border-b border-l border-[#F2F2F7] dark:border-white/10 ${tone.soft}`}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
                      <span className={`w-2 h-2 rounded-full ${tone.dot}`} />{g.label}
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr>
              {cols.map((c) => (
                <th key={c.id} title={c.id} className="px-1.5 py-2 border-b border-[#F2F2F7] dark:border-white/10 align-bottom">
                  <div className="text-[11px] font-medium text-[#86868B] whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto h-16">{c.actionLabel}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const tone = TONES[role.tone];
              const isAdmin = role.value === 'admin';
              return (
                <tr key={role.value} className="hover:bg-[#F5F5F7]/40 dark:hover:bg-white/5 transition-colors">
                  <th scope="row" className="sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] px-4 py-2.5 text-left border-b border-r border-[#F2F2F7] dark:border-white/10 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${tone.dot} shrink-0`} />
                      <span className="text-sm font-medium text-[#1D1D1F] dark:text-white truncate">{role.short}</span>
                      {isAdmin && <Crown className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                    </div>
                  </th>
                  {cols.map((c) => {
                    const has = roleHasPermission(role.value, c.id);
                    const cTone = TONES[c.tone];
                    return (
                      <td key={c.id} className="px-1.5 py-2.5 text-center border-b border-[#F2F2F7] dark:border-white/10">
                        {has ? (
                          <Check className={`w-4 h-4 mx-auto ${cTone.text}`} strokeWidth={3} />
                        ) : (
                          <span className="block w-1 h-1 rounded-full bg-[#E5E5EA] dark:bg-white/15 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 px-4 py-3 border-t border-[#F2F2F7] dark:border-white/10 text-xs text-[#86868B]">
        <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" strokeWidth={3} /> Otorgado</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#E5E5EA] dark:bg-white/15" /> Sin acceso</span>
        <span className="inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-purple-500" /> Admin / Master: acceso total (omite el guard)</span>
      </div>
    </div>
  );
}
