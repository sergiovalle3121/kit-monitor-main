'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, FileText, Table, Presentation, Check, Loader2, Cloud, CloudOff,
  Lock, Maximize2, Minimize2, Keyboard, X,
} from 'lucide-react';
import { OfficeChromeProvider } from './ribbon/OfficeChrome';
import {
  OFFICE_SHORTCUT_AVAILABILITY_LABELS,
  getOfficeShortcutGroups,
  type OfficeShortcutAvailability,
} from './officeShortcuts';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'readonly';
export type OfficeType = 'doc' | 'sheet' | 'slides';

const META: Record<OfficeType, { label: string; icon: typeof FileText; color: string; ring: string }> = {
  doc: { label: 'Documento', icon: FileText, color: 'text-blue-500', ring: 'bg-blue-500/10' },
  sheet: { label: 'Hoja de cálculo', icon: Table, color: 'text-emerald-500', ring: 'bg-emerald-500/10' },
  slides: { label: 'Presentación', icon: Presentation, color: 'text-amber-500', ring: 'bg-amber-500/10' },
};

function StatusPill({ status, savedAt }: { status: SaveStatus; savedAt?: number | null }) {
  const rel = useRelativeTime(savedAt);
  const map: Record<SaveStatus, { icon: React.ReactNode; text: string; cls: string }> = {
    saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Guardando…', cls: 'text-gray-500 dark:text-gray-400' },
    saved: { icon: <Check className="w-3.5 h-3.5" />, text: savedAt ? `Guardado ${rel}` : 'Guardado', cls: 'text-emerald-600 dark:text-emerald-400' },
    unsaved: { icon: <Cloud className="w-3.5 h-3.5" />, text: 'Cambios sin guardar', cls: 'text-gray-500 dark:text-gray-400' },
    error: { icon: <CloudOff className="w-3.5 h-3.5" />, text: 'Error al guardar', cls: 'text-red-500' },
    readonly: { icon: <Lock className="w-3.5 h-3.5" />, text: 'Solo lectura', cls: 'text-amber-600 dark:text-amber-400' },
  };
  const s = map[status];
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 ${s.cls}`}>
      {s.icon}
      <span className="hidden sm:inline">{s.text}</span>
    </div>
  );
}

function useRelativeTime(ts?: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ts) return;
    queueMicrotask(() => setNow(Date.now()));
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [ts]);
  if (!ts) return '';
  const s = Math.round((now - ts) / 1000);
  if (s < 8) return 'ahora';
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return `hace ${h} h`;
}

/**
 * Immersive, full-screen Office editor frame. Covers the dashboard chrome and
 * arranges a desktop-app layout: top app bar · ribbon · canvas · status bar.
 */
export function OfficeShell({
  type, title, onTitleChange, status, savedAt, readOnly,
  ribbon, actions, statusBarLeft, statusBarRight, children, onBack,
}: {
  type: OfficeType;
  title: string;
  onTitleChange: (v: string) => void;
  status: SaveStatus;
  savedAt?: number | null;
  readOnly?: boolean;
  ribbon?: React.ReactNode;
  actions?: React.ReactNode;
  statusBarLeft?: React.ReactNode;
  statusBarRight?: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  const meta = META[type];
  const Icon = meta.icon;
  const [isFs, setIsFs] = useState(false);
  const [help, setHelp] = useState(false);
  // Host del ribbon: los editores portan su cinta aquí (debajo del header).
  const [ribbonHost, setRibbonHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (help && e.key === 'Escape') {
        e.preventDefault();
        setHelp(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help]);

  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  return (
    <OfficeChromeProvider value={{ ribbonHost }}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // z por encima de los botones flotantes globales (chat z-100, IA z-101) para que
      // el editor a pantalla completa no quede tapado por ellos; sigue por debajo de
      // toasts (z-120) y la paleta de búsqueda (z-200), que sí deben verse encima.
      className="fixed inset-0 z-[110] flex flex-col bg-white dark:bg-[#0b0b0b] text-foreground font-sans"
    >
      {/* ── Top app bar ───────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 h-12 flex-shrink-0 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-[#111]/80 backdrop-blur">
        <button
          onClick={() => (onBack ? onBack() : router.push('/dashboard/office'))}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-foreground transition-colors flex-shrink-0 pr-1"
          title="Volver a Office"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden md:inline">Office</span>
        </button>
        <span className="w-px h-5 bg-black/10 dark:bg-white/10" />
        <span className={`inline-flex p-1.5 rounded-lg ${meta.ring} flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${meta.color}`} />
        </span>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Título del documento"
          disabled={readOnly}
          className="bg-transparent outline-none text-sm font-semibold min-w-0 flex-1 max-w-md px-1.5 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 focus:bg-black/5 dark:focus:bg-white/5 transition-colors disabled:opacity-70"
        />
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <StatusPill status={readOnly ? 'readonly' : status} savedAt={savedAt} />
          {actions}
          <button
            onClick={() => setHelp(true)}
            title="Atajos de teclado (Ctrl/Cmd+/)"
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFs}
            title={isFs ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
          >
            {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {help && <ShortcutsHelp type={type} readOnly={readOnly} onClose={() => setHelp(false)} />}
      </AnimatePresence>

      {/* ── Ribbon (host del portal: cada editor inyecta su cinta aquí) ─── */}
      <div ref={setRibbonHost} className="flex-shrink-0 empty:hidden">{ribbon}</div>

      {/* ── Canvas ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-auto relative">{children}</main>

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <footer className="flex items-center gap-3 px-3 h-7 flex-shrink-0 border-t border-black/5 dark:border-white/10 bg-gray-50 dark:bg-[#0e0e0e] text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-medium">{meta.label}</span>
        {readOnly && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Lock className="w-3 h-3" /> Solo lectura
          </span>
        )}
        {statusBarLeft}
        <div className="ml-auto flex items-center gap-3">{statusBarRight}</div>
      </footer>
    </motion.div>
    </OfficeChromeProvider>
  );
}

function availabilityClass(availability: OfficeShortcutAvailability): string {
  if (availability === 'available') return 'border-emerald-500/25 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
  if (availability === 'focus-dependent') return 'border-sky-500/25 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200';
  if (availability === 'read-only-blocked') return 'border-amber-500/25 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-gray-300 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-gray-300';
}

function ShortcutsHelp({ type, readOnly, onClose }: { type: OfficeType; readOnly?: boolean; onClose: () => void }) {
  const groups = getOfficeShortcutGroups(type, !!readOnly);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Atajos de teclado</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {type === 'sheet' ? 'AXOS Sheets muestra atajos reales del workbook, barra fx, impresion y rejilla.' : 'Comandos disponibles para el editor actual.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid max-h-[68vh] gap-3 overflow-auto pr-1 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="rounded-xl border border-black/10 bg-gray-50/70 p-2 dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.title}</h3>
              <div className="space-y-1">
                {group.commands.map((command) => (
                  <div key={command.id} className="rounded-lg bg-white px-2 py-2 text-sm shadow-sm dark:bg-black/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{command.label}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{command.note}</div>
                      </div>
                      <kbd className="shrink-0 whitespace-nowrap rounded-md bg-black/5 px-2 py-1 font-mono text-[11px] text-gray-700 dark:bg-white/10 dark:text-gray-200">{command.keys}</kbd>
                    </div>
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${availabilityClass(command.availability)}`}>
                      {OFFICE_SHORTCUT_AVAILABILITY_LABELS[command.availability]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Small reusable status-message used while the document loads or errors out. */
export function OfficeShellMessage({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0b0b0b] text-center px-6"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
