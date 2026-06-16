'use client';

/** Primitivas locales del visor de genealogía. Nada compartido fuera del carril. */

import { type ReactNode, useState } from 'react';
import { Check, Copy, Inbox, Loader2, Lock, type LucideIcon } from 'lucide-react';
import { glass } from '@/lib/glass';
import { copyText } from '../_lib/format';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function Badge({
  children,
  color = '#6b7280',
  mono = false,
}: {
  children: ReactNode;
  color?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${mono ? 'font-mono' : ''}`}
      style={{ background: `${color}1f`, color }}
    >
      {children}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-gray-400">{label}</span>
        {Icon && <Icon className="h-4 w-4" style={{ color: color ?? '#9ca3af' }} />}
      </div>
      <div
        className="mt-1 truncate text-2xl font-semibold text-black dark:text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[12px] text-gray-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
}) {
  return (
    <div className={`${glass} rounded-3xl p-12 text-center`}>
      <Icon className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      <h3 className="font-semibold">{title}</h3>
      {body && <p className="mx-auto mt-1 max-w-lg text-sm text-gray-400">{body}</p>}
    </div>
  );
}

export function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className={`${glass} rounded-3xl p-12 text-center`}>
      <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
      <h3 className="font-semibold">Sin acceso</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
        Necesitas el permiso <code className="font-mono text-[12px]">{permission}</code> para
        ver esta consulta. Pídelo a un administrador.
      </p>
    </div>
  );
}

export function ErrorCard({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-200">
      {message || 'No se pudo cargar la consulta. Revisa que el API esté arriba e inténtalo de nuevo.'}
    </div>
  );
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function onClick() {
    const ok = await copyText(text);
    if (ok) {
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-black/5 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copiado' : label}
    </button>
  );
}
