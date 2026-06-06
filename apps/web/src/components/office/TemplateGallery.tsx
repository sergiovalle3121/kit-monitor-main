'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, FileText, Table, Presentation, FilePlus2 } from 'lucide-react';
import { TEMPLATES, type DocType, type TemplateDef } from '@/lib/office/templates';

const ICON: Record<DocType, typeof FileText> = { doc: FileText, sheet: Table, slides: Presentation };
const ACCENT: Record<DocType, string> = { doc: 'text-blue-500', sheet: 'text-emerald-500', slides: 'text-amber-500' };

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

  async function pick(t: TemplateDef) {
    if (busy) return;
    setBusy(t.id);
    try { await onPick(await t.build()); }
    catch { setBusy(null); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Elige una plantilla</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => pick(t)}
              disabled={!!busy}
              className="group text-left rounded-2xl border border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/30 p-4 transition-all hover:shadow-md disabled:opacity-60"
            >
              <div className="aspect-[4/3] rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-3 relative overflow-hidden">
                {busy === t.id
                  ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  : t.id === 'blank'
                    ? <FilePlus2 className="w-7 h-7 text-gray-400" />
                    : <Icon className={`w-7 h-7 ${ACCENT[type]} opacity-80`} />}
              </div>
              <p className="font-semibold text-sm truncate">{t.title}</p>
              <p className="text-[11px] text-gray-400 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
