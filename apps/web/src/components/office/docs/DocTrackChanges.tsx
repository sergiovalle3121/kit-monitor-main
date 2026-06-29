'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { GitPullRequestArrow, Check, X, Trash2, Eraser, PenLine, Eye, Paintbrush } from 'lucide-react';
import { RibbonGroup, RibbonSeparator, RibbonButton, RibbonSelect } from '../ribbon';
import { collectChanges, changeAuthors, type ChangeRange } from './trackChanges';

export type TrackView = 'markup' | 'simple' | 'final' | 'original';

const TRACK_VIEW_OPTIONS = [
  { label: 'Todas las revisiones', value: 'markup' },
  { label: 'Revisiones sencillas', value: 'simple' },
  { label: 'Sin marcas (final)', value: 'final' },
  { label: 'Original', value: 'original' },
];

export function DocTrackChanges({ editor, suggesting, setSuggesting, trackView, setTrackView }: { editor: Editor; suggesting: boolean; setSuggesting: (v: boolean) => void; trackView: TrackView; setTrackView: (v: TrackView) => void }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const changes = open ? collectChanges(editor.state.doc) : [];
  const authors = open ? changeAuthors(editor.state.doc) : [];
  const authorLabel = (a: string) => a || 'Autor desconocido';

  const quoted = (c: ChangeRange) => { try { return editor.state.doc.textBetween(c.from, c.to, ' '); } catch { return ''; } };
  const goTo = (c: ChangeRange) => editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  const changeLabel = (c: ChangeRange) => c.type === 'insertion' ? 'Inserción' : c.type === 'deletion' ? 'Eliminación' : 'Formato';
  const changeTone = (c: ChangeRange) => c.type === 'insertion' ? 'text-emerald-600' : c.type === 'deletion' ? 'text-red-500' : 'text-blue-500';
  const accept = (c: ChangeRange) => { (editor.chain().focus() as any).acceptChange(c.from, c.to, c.type).run(); refresh(); };
  const reject = (c: ChangeRange) => { (editor.chain().focus() as any).rejectChange(c.from, c.to, c.type).run(); refresh(); };
  const acceptAuthor = (a: string) => { (editor.chain().focus() as any).acceptChangesByAuthor(a).run(); refresh(); };
  const rejectAuthor = (a: string) => { (editor.chain().focus() as any).rejectChangesByAuthor(a).run(); refresh(); };

  return (
    <>
      <RibbonGroup label="Seguimiento">
        <RibbonButton icon={PenLine} label="Modo sugerencias" hideLabel={false} active={suggesting} onClick={() => setSuggesting(!suggesting)} />
        <RibbonButton icon={Trash2} label="Proponer eliminación" onClick={() => (editor.chain().focus() as any).proposeDeletion().run()} />
        <RibbonButton icon={Paintbrush} label="Marcar formato" onClick={() => (editor.chain().focus() as any).markFormattingChange('formatting', null, 'Formato propuesto').run()} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Mostrar para revisión">
        <Eye className="w-[17px] h-[17px] text-gray-500 mr-0.5" />
        <RibbonSelect title="Cómo mostrar las revisiones" value={trackView} onChange={(v) => setTrackView(v as TrackView)} width={156} options={TRACK_VIEW_OPTIONS} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Cambios">
        <RibbonButton icon={GitPullRequestArrow} label="Revisar cambios" hideLabel={false} onClick={() => { setOpen(true); refresh(); }} />
        <RibbonButton icon={Check} label="Aceptar todo" onClick={() => { (editor.chain().focus() as any).acceptAllChanges().run(); refresh(); }} />
        <RibbonButton icon={Eraser} label="Rechazar todo" onClick={() => { (editor.chain().focus() as any).rejectAllChanges().run(); refresh(); }} />
      </RibbonGroup>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 w-80 z-[55] bg-white dark:bg-[#161616] border-l border-black/10 dark:border-white/10 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-12 border-b border-black/5 dark:border-white/10 flex-shrink-0">
                <span className="font-semibold text-sm flex items-center gap-2">Control de cambios
                  {changes.length > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{changes.length}</span>}
                </span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {changes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 px-4">No hay cambios sugeridos. Activa «Modo sugerencias» y escribe, o selecciona texto para proponer eliminación/formato.</p>
                ) : authors.map((a) => {
                  const group = changes.filter((c) => (c.author || '') === a);
                  return (
                    <div key={a || '_'} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate">{authorLabel(a)}</span>
                        <span className="text-[10px] text-gray-400">{group.length}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => acceptAuthor(a)} title="Aceptar todo de este autor" className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="w-3 h-3" /> Todo</button>
                          <button onClick={() => rejectAuthor(a)} title="Rechazar todo de este autor" className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500"><X className="w-3 h-3" /> Todo</button>
                        </div>
                      </div>
                      {group.map((c, i) => (
                        <div key={i} className="rounded-xl border border-black/10 dark:border-white/10 p-3">
                          <button onClick={() => goTo(c)} className="block w-full text-left">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${changeTone(c)}`}>{changeLabel(c)}</span>
                            <p className={`text-sm mt-0.5 ${c.type === 'deletion' ? 'line-through text-red-500' : c.type === 'formatChange' ? 'text-blue-600 dark:text-blue-300 underline decoration-dotted underline-offset-4' : 'text-emerald-700 dark:text-emerald-400'}`}>“{quoted(c) || '—'}”</p>
                            {c.type === 'formatChange' ? <p className="text-[11px] text-gray-500 mt-1">{c.after || c.property || 'Formato propuesto'}</p> : null}
                            {c.date ? <p className="text-[11px] text-gray-400 mt-1">{new Date(c.date).toLocaleDateString('es-ES')}</p> : null}
                          </button>
                          <div className="flex items-center gap-1 mt-2">
                            <button onClick={() => accept(c)} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="w-3.5 h-3.5" /> Aceptar</button>
                            <button onClick={() => reject(c)} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 ml-auto"><X className="w-3.5 h-3.5" /> Rechazar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
