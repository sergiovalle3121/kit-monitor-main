'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import {
  Canvas, StaticCanvas, Textbox, Rect, Circle, Line, Triangle, FabricImage,
} from 'fabric';
import {
  Type, ImagePlus, Square, Circle as CircleIcon, Minus, Triangle as TriIcon,
  Trash2, ChevronsUp, ChevronsDown, Plus, Copy, Play, X, Bold, Plus as PlusIcon, Minus as MinusIcon,
  StickyNote,
} from 'lucide-react';

const CW = 960;
const CH = 540;
const PALETTE = ['#111827', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#7c3aed', '#ec4899'];

function blank() { return { version: '7', objects: [], background: '#ffffff' }; }
function labelOf(slide: any): string {
  const t = slide?.objects?.find((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  return (t?.text || '').split('\n')[0] || '';
}

function TBtn({ on, title, children }: any) {
  return (
    <button onClick={on} title={title} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors">{children}</button>
  );
}

export function SlidesEditor({ value, onChange, readOnly }: { value: any; onChange: (data: any) => void; readOnly?: boolean }) {
  const elRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const loadingRef = useRef(false);
  const curRef = useRef(0);

  const initial: any[] = value?.version === 2 && Array.isArray(value.slides) && value.slides.length ? value.slides : [blank()];
  const initialNotes: string[] = (() => {
    const n = Array.isArray(value?.notes) ? value.notes.slice(0, initial.length) : [];
    while (n.length < initial.length) n.push('');
    return n;
  })();
  const slidesRef = useRef<any[]>(initial);
  const notesRef = useRef<string[]>(initialNotes);
  const [slides, setSlides] = useState<any[]>(initial); // mirror for rendering
  const [cur, setCur] = useState(0);
  const [noteDraft, setNoteDraft] = useState<string>(initialNotes[0] ?? '');
  const [presenting, setPresenting] = useState(false);

  useEffect(() => { curRef.current = cur; }, [cur]);

  function sync() { setSlides([...slidesRef.current]); onChange({ version: 2, slides: slidesRef.current, notes: notesRef.current }); }
  function capture() { const c = fabricRef.current; if (c) slidesRef.current[curRef.current] = c.toJSON(); }

  useEffect(() => {
    if (!elRef.current) return;
    const canvas = new Canvas(elRef.current, { width: CW, height: CH, backgroundColor: '#ffffff', preserveObjectStacking: true });
    fabricRef.current = canvas;
    const onMod = () => { if (loadingRef.current) return; capture(); sync(); };
    canvas.on('object:added', onMod);
    canvas.on('object:modified', onMod);
    canvas.on('object:removed', onMod);
    loadInto(0);
    return () => { canvas.dispose(); fabricRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInto(i: number) {
    const c = fabricRef.current; if (!c) return;
    loadingRef.current = true;
    try {
      const json = slidesRef.current[i] || blank();
      await c.loadFromJSON(json);
      c.backgroundColor = (json.background as string) || '#ffffff';
      if (readOnly) {
        c.selection = false;
        c.forEachObject((o: any) => { o.selectable = false; o.evented = false; });
      }
      c.requestRenderAll();
    } catch { /* noop */ }
    loadingRef.current = false;
    curRef.current = i;
    setCur(i);
    setNoteDraft(notesRef.current[i] ?? '');
    setSlides([...slidesRef.current]);
  }
  function onNote(v: string) { setNoteDraft(v); notesRef.current[curRef.current] = v; sync(); }
  function goto(i: number) { capture(); loadInto(i); }

  function add(obj: any) { const c = fabricRef.current; if (!c) return; c.add(obj); c.setActiveObject(obj); c.requestRenderAll(); }
  function addText() { add(new Textbox('Texto', { left: 80, top: 80, width: 360, fontSize: 36, fill: '#111827', fontFamily: 'sans-serif' })); }
  function addRect() { add(new Rect({ left: 120, top: 120, width: 220, height: 130, fill: '#3b82f6', rx: 8, ry: 8 })); }
  function addCircle() { add(new Circle({ left: 140, top: 140, radius: 80, fill: '#10b981' })); }
  function addLine() { add(new Line([60, 60, 320, 60], { stroke: '#111827', strokeWidth: 4 })); }
  function addTriangle() { add(new Triangle({ left: 140, top: 140, width: 160, height: 140, fill: '#f59e0b' })); }
  function addImageFromUrl(url: string) {
    FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img: any) => {
      if (!img) return; img.scaleToWidth(360); img.set({ left: 100, top: 100 }); add(img);
    }).catch(() => {});
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') addImageFromUrl(reader.result); };
    reader.readAsDataURL(f);
    e.target.value = '';
  }
  function setColor(color: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c) return;
    if (!o) { c.backgroundColor = color; c.requestRenderAll(); capture(); sync(); return; }
    o.set(o.type === 'line' ? 'stroke' : 'fill', color); c.requestRenderAll(); capture(); sync();
  }
  function fontSize(delta: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (c && o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text')) { o.set('fontSize', Math.max(8, (o.fontSize || 24) + delta)); c.requestRenderAll(); capture(); sync(); }
  }
  function toggleBold() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (c && o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text')) { o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold'); c.requestRenderAll(); capture(); sync(); }
  }
  function del() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { c.remove(o); c.requestRenderAll(); } }
  function front() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { (c as any).bringObjectToFront(o); c.requestRenderAll(); capture(); sync(); } }
  function back() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { (c as any).sendObjectToBack(o); c.requestRenderAll(); capture(); sync(); } }

  function addSlide() { capture(); slidesRef.current.splice(cur + 1, 0, blank()); notesRef.current.splice(cur + 1, 0, ''); sync(); loadInto(cur + 1); }
  function dupSlide() { capture(); slidesRef.current.splice(cur + 1, 0, JSON.parse(JSON.stringify(slidesRef.current[cur]))); notesRef.current.splice(cur + 1, 0, notesRef.current[cur] ?? ''); sync(); loadInto(cur + 1); }
  function delSlide(i: number) { if (slidesRef.current.length === 1) return; slidesRef.current.splice(i, 1); notesRef.current.splice(i, 1); sync(); loadInto(Math.max(0, i <= cur ? cur - 1 : cur)); }

  return (
    <div className="flex flex-col gap-3 h-full p-3">
      <div className="flex items-center gap-0.5 flex-wrap rounded-2xl border border-gray-100 dark:border-white/10 px-2 py-1.5 bg-white dark:bg-[#111]">
        {!readOnly && <>
        <TBtn on={addText} title="Cuadro de texto"><Type className="w-4 h-4" /></TBtn>
        <label title="Imagen" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 cursor-pointer flex items-center">
          <ImagePlus className="w-4 h-4" /><input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>
        <TBtn on={addRect} title="Rectángulo"><Square className="w-4 h-4" /></TBtn>
        <TBtn on={addCircle} title="Círculo"><CircleIcon className="w-4 h-4" /></TBtn>
        <TBtn on={addTriangle} title="Triángulo"><TriIcon className="w-4 h-4" /></TBtn>
        <TBtn on={addLine} title="Línea"><Minus className="w-4 h-4" /></TBtn>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <TBtn on={toggleBold} title="Negrita"><Bold className="w-4 h-4" /></TBtn>
        <TBtn on={() => fontSize(4)} title="Texto más grande"><PlusIcon className="w-4 h-4" /></TBtn>
        <TBtn on={() => fontSize(-4)} title="Texto más chico"><MinusIcon className="w-4 h-4" /></TBtn>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        {PALETTE.map((col) => (
          <button key={col} onClick={() => setColor(col)} title={col} className="w-5 h-5 rounded-full border border-gray-300 mx-0.5" style={{ background: col }} />
        ))}
        <label title="Más colores" className="cursor-pointer mx-0.5 relative inline-flex">
          <span className="w-5 h-5 rounded-full border border-gray-300 inline-block" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }} />
          <input type="color" onChange={(e) => setColor(e.target.value)} className="w-0 h-0 opacity-0 absolute inset-0" />
        </label>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <TBtn on={front} title="Traer al frente"><ChevronsUp className="w-4 h-4" /></TBtn>
        <TBtn on={back} title="Enviar atrás"><ChevronsDown className="w-4 h-4" /></TBtn>
        <TBtn on={del} title="Borrar elemento"><Trash2 className="w-4 h-4" /></TBtn>
        </>}
        <div className="ml-auto">
          <button onClick={() => { capture(); setPresenting(true); }} className="flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform"><Play className="w-4 h-4" /> Presentar</button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-44 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
          {slides.map((s, i) => (
            <div key={i} className="relative group">
              <button onClick={() => goto(i)} className={`w-full text-left rounded-lg border-2 transition-all ${i === cur ? 'border-amber-500' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}>
                <div className="aspect-video bg-white rounded-md overflow-hidden p-2 flex flex-col">
                  <span className="text-[9px] text-gray-400 font-mono">{i + 1}</span>
                  <p className="font-bold text-[10px] text-black line-clamp-2 mt-1">{labelOf(s) || 'Diapositiva'}</p>
                </div>
              </button>
              {!readOnly && slides.length > 1 && (
                <button onClick={() => delSlide(i)} className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow"><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          {!readOnly && (
          <div className="flex gap-2">
            <button onClick={addSlide} title="Nueva" className="flex-1 aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Plus className="w-5 h-5" /></button>
            <button onClick={dupSlide} title="Duplicar" className="flex-1 aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Copy className="w-5 h-5" /></button>
          </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <div className="flex-1 min-h-0 bg-gray-100 dark:bg-[#0b0b0b] rounded-2xl flex items-center justify-center overflow-auto p-4">
            <div className="shadow-2xl" style={{ width: CW, height: CH, maxWidth: '100%' }}>
              <canvas ref={elRef} width={CW} height={CH} />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-start gap-2">
            <span title="Notas del orador" className="mt-2 text-gray-400"><StickyNote className="w-4 h-4" /></span>
            <textarea
              value={noteDraft}
              onChange={(e) => onNote(e.target.value)}
              disabled={readOnly}
              placeholder="Notas del orador para esta diapositiva…"
              className="flex-1 h-16 resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111] px-3 py-2 text-sm outline-none focus:ring-2 ring-amber-500/30 disabled:opacity-70"
            />
          </div>
        </div>
      </div>

      {presenting && <Present slides={slides} notes={notesRef.current} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function Present({ slides, notes, onClose }: { slides: any[]; notes?: string[]; onClose: () => void }) {
  const [imgs, setImgs] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const out: string[] = [];
      for (const json of slides) {
        try {
          const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: CH });
          await sc.loadFromJSON(json);
          sc.backgroundColor = (json.background as string) || '#ffffff';
          sc.renderAll();
          out.push(sc.toDataURL({ format: 'png', multiplier: 1 } as any));
          sc.dispose();
        } catch { out.push(''); }
      }
      if (active) setImgs(out);
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(slides.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
      if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => { active = false; window.removeEventListener('keydown', onKey); };
  }, [slides, onClose]);

  const note = notes?.[i]?.trim();
  const hasNotes = (notes ?? []).some((n) => n?.trim());

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {hasNotes && (
          <button onClick={() => setShowNotes((v) => !v)} title="Notas del orador (N)" className={`p-2 rounded-full text-white transition-colors ${showNotes ? 'bg-amber-500/80' : 'bg-white/15 hover:bg-white/30'}`}><StickyNote className="w-5 h-5" /></button>
        )}
        <button onClick={onClose} title="Cerrar (Esc)" className="p-2 rounded-full bg-white/15 text-white hover:bg-white/30"><X className="w-5 h-5" /></button>
      </div>
      {imgs[i] ? <img src={imgs[i]} alt={`Diapositiva ${i + 1}`} className="max-w-full max-h-full object-contain" /> : <div className="text-white/60">Generando…</div>}
      <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20">‹</button>
      <button onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))} disabled={i === slides.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20">›</button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{i + 1} / {slides.length}</div>
      {showNotes && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[30%] overflow-y-auto bg-black/80 backdrop-blur border-t border-white/10 px-8 py-4 text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
          {note || <span className="text-white/40">Sin notas para esta diapositiva.</span>}
        </div>
      )}
    </div>
  );
}
