'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, FileText, Table, Presentation, FilePlus2 } from 'lucide-react';
import { TEMPLATES, TEMPLATE_CATEGORIES, type DocType, type TemplateDef } from '@/lib/office/templates';
import { summarizeSheetTemplateBuild, type SheetTemplateReadinessLevel, type SheetTemplateReadinessSummary } from '@/lib/office/templateReadiness';

const ICON: Record<DocType, typeof FileText> = { doc: FileText, sheet: Table, slides: Presentation };
const FALLBACK_ACCENT: Record<DocType, string> = { doc: '#2563eb', sheet: '#10b981', slides: '#f59e0b' };

function readinessTone(level: SheetTemplateReadinessLevel): string {
  if (level === 'governed') return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
  if (level === 'connected') return 'border-sky-500/30 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200';
  if (level === 'analysis') return 'border-indigo-500/30 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200';
  if (level === 'starter') return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-slate-300 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';
}

function readinessTitle(description: string, readiness?: SheetTemplateReadinessSummary | null): string {
  if (!readiness) return description;
  const badges = readiness.badges.length ? ` · ${readiness.badges.join(', ')}` : '';
  const warnings = readiness.warnings.length ? ` · Review ${readiness.warnings.length}` : '';
  return `${description} · ${readiness.label} ${readiness.score}/100${badges}${warnings}`;
}

export function TemplateGallery({
  type, onPick, onClose,
}: {
  type: DocType;
  onPick: (content: any) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const list = TEMPLATES[type];
  const Icon = ICON[type];
  const readinessById = useMemo(() => {
    if (type !== 'sheet') return new Map<string, SheetTemplateReadinessSummary>();
    return new Map(list.map((template) => [template.id, summarizeSheetTemplateBuild(template)]));
  }, [list, type]);

  async function pick(t: TemplateDef) {
    if (busy) return;
    setBusy(t.id);
    try { await onPick(await t.build()); }
    catch { setBusy(null); }
  }

  // Agrupa por categoría siguiendo el orden declarado; lo no listado va al final.
  const order = TEMPLATE_CATEGORIES[type] || [];
  const seen = new Set<string>();
  const groups: { cat: string; items: TemplateDef[] }[] = [];
  for (const cat of order) {
    const items = list.filter((t) => (t.category || 'General') === cat);
    if (items.length) { groups.push({ cat, items }); items.forEach((t) => seen.add(t.id)); }
  }
  const rest = list.filter((t) => !seen.has(t.id));
  if (rest.length) groups.push({ cat: 'Otras', items: rest });
  const showHeaders = groups.length > 1;

  const card = (t: TemplateDef) => {
    const accent = t.accent || FALLBACK_ACCENT[type];
    const isBlank = t.id === 'blank';
    const readiness = type === 'sheet' ? readinessById.get(t.id) : null;
    return (
      <button
        key={t.id}
        onClick={() => pick(t)}
        disabled={!!busy}
        title={readinessTitle(t.description, readiness)}
        className="group text-left rounded-2xl border border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/30 p-3 transition-all hover:shadow-md disabled:opacity-60"
      >
        <div
          className="aspect-[4/3] rounded-xl flex items-center justify-center mb-2.5 relative overflow-hidden border border-black/5 dark:border-white/10"
          style={{ background: isBlank ? undefined : `linear-gradient(135deg, ${accent}26, ${accent}0a)` }}
        >
          {!isBlank && <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} />}
          {busy === t.id
            ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            : isBlank
              ? <FilePlus2 className="w-7 h-7 text-gray-400" />
              : <Icon className="w-7 h-7" style={{ color: accent }} />}
        </div>
        <p className="font-semibold text-sm truncate">{t.title}</p>
        <p className="text-[11px] text-gray-400 line-clamp-2">{t.description}</p>
        {readiness && !isBlank && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${readinessTone(readiness.level)}`}>
              {readiness.label} {readiness.score}
            </span>
            {readiness.badges.slice(0, 2).map((badge) => (
              <span key={badge} className="inline-flex rounded-full border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                {badge}
              </span>
            ))}
            {readiness.warnings.length > 0 && (
              <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                Review {readiness.warnings.length}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-bold">Elige una plantilla</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.cat} className="mb-5 last:mb-0">
              {showHeaders && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">{g.cat}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {g.items.map(card)}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
