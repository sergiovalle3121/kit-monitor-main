'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Braces, ChevronDown, ExternalLink, FileText, Link2 } from 'lucide-react';
import { axosEntityLabel, axosRefHref, axosRefText } from '@/lib/office/axosRefs';

interface AxosRefItem { entity: string; refId: string; label: string; href: string | null }
interface DocFieldItem { key: string; label: string; value: string }

function walk(node: any, visit: (node: any) => void) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

function collect(content: any): { refs: AxosRefItem[]; fields: DocFieldItem[] } {
  const refs = new Map<string, AxosRefItem>();
  const fields = new Map<string, DocFieldItem>();
  walk(content, (node) => {
    if (node.type === 'axosRef') {
      const entity = String(node.attrs?.entity || '');
      const refId = String(node.attrs?.refId || '');
      const key = `${entity}:${refId}:${node.attrs?.label || ''}`;
      refs.set(key, { entity, refId, label: axosRefText(entity, refId, node.attrs?.label), href: axosRefHref(entity, refId) });
    }
    if (node.type === 'docField') {
      const key = String(node.attrs?.key || '');
      fields.set(key, { key, label: String(node.attrs?.label || key), value: String(node.attrs?.value || '') });
    }
  });
  return { refs: [...refs.values()], fields: [...fields.values()] };
}

export function DocSmartRefsPanel({ content }: { content: any }) {
  const [open, setOpen] = useState(false);
  const { refs, fields } = useMemo(() => collect(content), [content]);

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} title="Referencias AXOS y campos"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">
        <Link2 className="h-4 w-4 text-blue-500" />
        <span className="hidden lg:inline">Refs</span>
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{refs.length + fields.length}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 z-20 mt-1 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]">
              <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-bold">Referencias inteligentes</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">AXOS refs y campos vivos detectados en el documento.</p>
              </div>
              <div className="overflow-y-auto p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">AXOS refs · {refs.length}</p>
                {refs.length === 0 ? <p className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-white/5">Sin referencias AXOS.</p> : (
                  <div className="mb-4 space-y-1.5">
                    {refs.map((ref) => (
                      <a key={`${ref.entity}:${ref.refId}:${ref.label}`} href={ref.href || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!ref.href) e.preventDefault(); }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Link2 className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{ref.label}</span><span className="block truncate text-xs text-gray-500">{axosEntityLabel(ref.entity)} · {ref.refId || 'sin id'}</span></span>
                        {ref.href && <ExternalLink className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Campos vivos · {fields.length}</p>
                {fields.length === 0 ? <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-white/5">Sin campos vivos.</p> : (
                  <div className="space-y-1.5">
                    {fields.map((field) => (
                      <div key={field.key} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Braces className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{field.label}</span><span className="block truncate text-xs text-gray-500">{field.value || field.key}</span></span>
                        <FileText className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
