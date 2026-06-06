'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Play, X } from 'lucide-react';
import '@/styles/reveal/reveal.css';
import '@/styles/reveal/white.css';

interface Slide { title: string; body: string }

/** PowerPoint-like slide editor with a reveal.js (MIT) present mode. */
export function SlidesEditor({ value, onChange }: { value: any; onChange: (data: any) => void }) {
  const initial: Slide[] = Array.isArray(value?.slides) && value.slides.length
    ? value.slides
    : [{ title: 'Título de la diapositiva', body: 'Primer punto\nSegundo punto' }];
  const [slides, setSlides] = useState<Slide[]>(initial);
  const [cur, setCur] = useState(0);
  const [presenting, setPresenting] = useState(false);

  function commit(next: Slide[]) {
    setSlides(next);
    onChange({ slides: next });
  }
  function update(patch: Partial<Slide>) {
    const next = slides.map((s, i) => (i === cur ? { ...s, ...patch } : s));
    commit(next);
  }
  function addSlide() {
    const next = [...slides, { title: 'Nueva diapositiva', body: '' }];
    commit(next);
    setCur(next.length - 1);
  }
  function removeSlide(i: number) {
    if (slides.length === 1) return;
    const next = slides.filter((_, idx) => idx !== i);
    commit(next);
    setCur(Math.max(0, cur - (i <= cur ? 1 : 0)));
  }

  const slide = slides[cur];

  return (
    <div className="flex gap-4 h-[70vh]">
      {/* Thumbnails */}
      <div className="w-44 flex-shrink-0 overflow-y-auto space-y-2">
        {slides.map((s, i) => (
          <button key={i} onClick={() => setCur(i)} className={`w-full text-left aspect-video rounded-xl border p-2 text-[10px] relative overflow-hidden transition-all ${i === cur ? 'border-black dark:border-white ring-2 ring-black/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'} bg-white dark:bg-[#111]`}>
            <span className="absolute top-1 left-1.5 text-gray-400 font-mono">{i + 1}</span>
            <p className="font-bold mt-3 line-clamp-2 text-black dark:text-white">{s.title}</p>
          </button>
        ))}
        <button onClick={addSlide} className="w-full aspect-video rounded-xl border border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Diapositiva {cur + 1} de {slides.length}</span>
          <div className="flex gap-2">
            <button onClick={() => removeSlide(cur)} disabled={slides.length === 1} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => setPresenting(true)} className="flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-3 py-1.5 rounded-full hover:scale-[1.03] active:scale-95 transition-transform"><Play className="w-4 h-4" /> Presentar</button>
          </div>
        </div>
        <div className="flex-1 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] p-6 flex flex-col gap-4">
          <input value={slide.title} onChange={(e) => update({ title: e.target.value })} placeholder="Título" className="text-2xl font-bold bg-transparent outline-none" />
          <textarea value={slide.body} onChange={(e) => update({ body: e.target.value })} placeholder="Un punto por línea…" className="flex-1 bg-transparent outline-none resize-none text-base leading-relaxed" />
        </div>
      </div>

      {presenting && <Present slides={slides} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function Present({ slides, onClose }: { slides: Slide[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let deck: any;
    let cancelled = false;
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
              <ul>
                {s.body.split('\n').filter(Boolean).map((line, j) => <li key={j}>{line}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
