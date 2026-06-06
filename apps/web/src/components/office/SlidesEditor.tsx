'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Play, X, Copy } from 'lucide-react';
import '@/styles/reveal/reveal.css';
import '@/styles/reveal/white.css';

interface Slide { title: string; body: string }

/** PowerPoint-like slide editor with a reveal.js (MIT) present mode. */
export function SlidesEditor({ value, onChange }: { value: any; onChange: (data: any) => void }) {
  const initial: Slide[] = Array.isArray(value?.slides) && value.slides.length
    ? value.slides
    : [{ title: 'Título de la presentación', body: 'Primer punto\nSegundo punto' }];
  const [slides, setSlides] = useState<Slide[]>(initial);
  const [cur, setCur] = useState(0);
  const [presenting, setPresenting] = useState(false);

  function commit(next: Slide[]) { setSlides(next); onChange({ slides: next }); }
  function update(patch: Partial<Slide>) { commit(slides.map((s, i) => (i === cur ? { ...s, ...patch } : s))); }
  function addSlide() { const next = [...slides.slice(0, cur + 1), { title: 'Nueva diapositiva', body: '' }, ...slides.slice(cur + 1)]; commit(next); setCur(cur + 1); }
  function duplicate() { const next = [...slides.slice(0, cur + 1), { ...slides[cur] }, ...slides.slice(cur + 1)]; commit(next); setCur(cur + 1); }
  function removeSlide(i: number) { if (slides.length === 1) return; commit(slides.filter((_, idx) => idx !== i)); setCur(Math.max(0, cur - (i <= cur ? 1 : 0))); }

  const slide = slides[cur];

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 110px)' }}>
      {/* Thumbnails */}
      <div className="w-52 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
        {slides.map((s, i) => (
          <button key={i} onClick={() => setCur(i)} className={`w-full text-left rounded-lg border-2 transition-all relative ${i === cur ? 'border-amber-500' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}>
            <span className="absolute -left-0 top-0 text-[10px] text-gray-400 font-mono px-1">{i + 1}</span>
            <div className="aspect-video bg-white rounded-md overflow-hidden p-2 flex flex-col">
              <p className="font-bold text-[9px] text-black line-clamp-1">{s.title}</p>
              <p className="text-[7px] text-gray-500 line-clamp-3 mt-0.5 whitespace-pre-line">{s.body}</p>
            </div>
          </button>
        ))}
        <button onClick={addSlide} className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Diapositiva {cur + 1} de {slides.length}</span>
          <div className="flex gap-2">
            <button onClick={duplicate} className="p-2 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors" title="Duplicar"><Copy className="w-4 h-4" /></button>
            <button onClick={() => removeSlide(cur)} disabled={slides.length === 1} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30" title="Borrar"><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => setPresenting(true)} className="flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform"><Play className="w-4 h-4" /> Presentar</button>
          </div>
        </div>

        {/* Big 16:9 canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-[#0b0b0b] rounded-2xl p-4 md:p-8 overflow-auto">
          <div className="w-full max-w-4xl aspect-video bg-white shadow-2xl rounded-lg flex flex-col px-10 md:px-14 py-10 text-black">
            <textarea value={slide.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título"
              className="w-full text-3xl md:text-4xl font-bold bg-transparent outline-none resize-none mb-4 leading-tight" rows={1} />
            <textarea value={slide.body} onChange={(e) => update({ body: e.target.value })} placeholder="Un punto por línea…"
              className="flex-1 w-full bg-transparent outline-none resize-none text-lg md:text-xl leading-relaxed text-gray-700" />
          </div>
        </div>
      </div>

      {presenting && <Present slides={slides} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function Present({ slides, onClose }: { slides: Slide[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let deck: any; let cancelled = false;
    import('reveal.js').then(({ default: Reveal }) => {
      if (cancelled || !ref.current) return;
      deck = new Reveal(ref.current, { embedded: false, hash: false, controls: true, progress: true });
      deck.initialize();
    });
    return () => { cancelled = true; try { deck?.destroy(); } catch { /* noop */ } };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] bg-white">
      <button onClick={onClose} className="absolute top-4 right-4 z-[210] p-2 rounded-full bg-black/80 text-white hover:bg-black"><X className="w-5 h-5" /></button>
      <div className="reveal" ref={ref}>
        <div className="slides">
          {slides.map((s, i) => (
            <section key={i}>
              <h2>{s.title}</h2>
              <ul>{s.body.split('\n').filter(Boolean).map((line, j) => <li key={j}>{line}</li>)}</ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
