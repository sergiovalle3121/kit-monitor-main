'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Canvas, StaticCanvas, Textbox, Rect, Circle, Line, Triangle, FabricImage, Polygon, Shadow, Gradient,
} from 'fabric';
import {
  Type, ImagePlus, Square, Circle as CircleIcon, Minus, Triangle as TriIcon,
  Trash2, ChevronsUp, ChevronsDown, Plus, Copy, Play, X, Bold, Plus as PlusIcon, Minus as MinusIcon,
  StickyNote, CopyPlus, LayoutGrid, Star, ArrowRight, Diamond, FileText, Palette, PaintBucket,
  Italic, Underline, AlignLeft, AlignCenter, AlignRight, Droplet, Blend, Link2, FlipHorizontal, FlipVertical, Lock, Unlock,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
} from 'lucide-react';
import { SlideSorter } from './SlideSorter';
import {
  OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator,
  RibbonButton, RibbonSelect, RibbonColorButton,
} from './ribbon';

const CW = 960;
const CH = 540;

function blank() { return { version: '7', objects: [], background: '#ffffff' }; }
function labelOf(slide: any): string {
  const t = slide?.objects?.find((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  return (t?.text || '').split('\n')[0] || '';
}

export function SlidesEditor({ value, onChange, readOnly, fileActions }: { value: any; onChange: (data: any) => void; readOnly?: boolean; fileActions?: React.ReactNode }) {
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
  const [transition, setTransition] = useState<string>(value?.transition || 'fade');
  const transitionRef = useRef<string>(transition);
  const clipboardRef = useRef<any>(null);
  const [presenting, setPresenting] = useState(false);
  const [sorter, setSorter] = useState(false);
  const [selAnim, setSelAnim] = useState<string>('none');
  const [selOpacity, setSelOpacity] = useState(1);
  const [selLocked, setSelLocked] = useState(false);
  const [hasSel, setHasSel] = useState(false);

  useEffect(() => { curRef.current = cur; }, [cur]);

  function setObjAnim(v: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.set('anim', v === 'none' ? undefined : v);
    setSelAnim(v); capture(); sync();
  }

  function sync() { setSlides([...slidesRef.current]); onChange({ version: 2, slides: slidesRef.current, notes: notesRef.current, transition: transitionRef.current }); }
  function setTrans(t: string) { setTransition(t); transitionRef.current = t; sync(); }
  function applyBgAll(color: string) {
    capture();
    for (const s of slidesRef.current) s.background = color;
    const c = fabricRef.current; if (c) { c.backgroundColor = color; c.requestRenderAll(); }
    sync();
  }
  // Include custom props (anim = entrance animation, shape = .pptx mapping, link = hyperlink, locked).
  function capture() { const c = fabricRef.current; if (c) slidesRef.current[curRef.current] = c.toObject(['anim', 'shape', 'link', 'locked']); }
  function applyLock(o: any) {
    const L = !!o.locked;
    o.set({ lockMovementX: L, lockMovementY: L, lockScalingX: L, lockScalingY: L, lockRotation: L, hasControls: !L });
  }
  function toggleLock() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.locked = !o.locked; applyLock(o); setSelLocked(!!o.locked);
    c.requestRenderAll(); capture(); sync();
  }

  useEffect(() => {
    if (!elRef.current) return;
    const canvas = new Canvas(elRef.current, { width: CW, height: CH, backgroundColor: '#ffffff', preserveObjectStacking: true });
    fabricRef.current = canvas;
    const onMod = () => { if (loadingRef.current) return; capture(); sync(); };
    canvas.on('object:added', onMod);
    canvas.on('object:modified', onMod);
    canvas.on('object:removed', onMod);
    const onSel = () => { const o = canvas.getActiveObject() as any; setHasSel(!!o); setSelAnim((o?.anim as string) || 'none'); setSelOpacity(o?.opacity ?? 1); setSelLocked(!!o?.locked); };
    canvas.on('selection:created', onSel);
    canvas.on('selection:updated', onSel);
    canvas.on('selection:cleared', () => { setHasSel(false); setSelAnim('none'); });
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
      } else {
        c.forEachObject((o: any) => { if (o.locked) applyLock(o); });
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
  function addStar() {
    const outer = 80; const inner = 32; const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) { const r = i % 2 === 0 ? outer : inner; const a = i * (Math.PI / 5) - Math.PI / 2; pts.push({ x: outer + r * Math.cos(a), y: outer + r * Math.sin(a) }); }
    add(new Polygon(pts, { left: 140, top: 120, fill: '#f59e0b', shape: 'star5' } as any));
  }
  function addArrow() {
    const pts = [{ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 0 }, { x: 160, y: 50 }, { x: 100, y: 100 }, { x: 100, y: 70 }, { x: 0, y: 70 }];
    add(new Polygon(pts, { left: 130, top: 160, fill: '#3b82f6', shape: 'rightArrow' } as any));
  }
  function addDiamond() {
    const pts = [{ x: 70, y: 0 }, { x: 140, y: 70 }, { x: 70, y: 140 }, { x: 0, y: 70 }];
    add(new Polygon(pts, { left: 150, top: 130, fill: '#10b981', shape: 'diamond' } as any));
  }
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
  const isText = (o: any) => o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  function textSet(mut: (o: any) => void) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (c && isText(o)) { mut(o); c.requestRenderAll(); capture(); sync(); }
  }
  function toggleBold() { textSet((o) => o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold')); }
  function toggleItalic() { textSet((o) => o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic')); }
  function toggleUnderline() { textSet((o) => o.set('underline', !o.underline)); }
  function setTextAlign(a: string) { textSet((o) => o.set('textAlign', a)); }
  function setTextFont(f: string) { textSet((o) => o.set('fontFamily', f)); }
  function toggleShadow() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.set('shadow', o.shadow ? null : new Shadow({ color: 'rgba(0,0,0,0.35)', blur: 14, offsetX: 5, offsetY: 6 }));
    c.requestRenderAll(); capture(); sync();
  }
  function applyGradient() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o || o.type === 'line') return;
    const w = (o.width || 200) * (o.scaleX || 1);
    const base = typeof o.fill === 'string' ? o.fill : '#3b82f6';
    o.set('fill', new Gradient({
      type: 'linear', gradientUnits: 'pixels',
      coords: { x1: 0, y1: 0, x2: w, y2: 0 },
      colorStops: [{ offset: 0, color: base }, { offset: 1, color: '#7c3aed' }],
    }));
    c.requestRenderAll(); capture(); sync();
  }
  function setObjLink() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    const cur = o.link ? (o.link.type === 'url' ? o.link.href : String((o.link.index ?? 0) + 1)) : '';
    const v = window.prompt('Vincular a: número de diapositiva o URL (vacío = quitar)', cur);
    if (v === null) return;
    const t = v.trim();
    if (!t) o.set('link', null);
    else if (/^https?:\/\//i.test(t)) o.set('link', { type: 'url', href: t });
    else { const n = parseInt(t, 10); if (!Number.isNaN(n) && n > 0) o.set('link', { type: 'slide', index: n - 1 }); else { window.alert('Indica un número de diapositiva o una URL http(s).'); return; } }
    c.requestRenderAll(); capture(); sync();
  }
  function flip(axis: 'x' | 'y') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (c && o) { o.set(axis === 'x' ? 'flipX' : 'flipY', !(axis === 'x' ? o.flipX : o.flipY)); c.requestRenderAll(); capture(); sync(); }
  }
  function setOpacity(v: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (c && o) { o.set('opacity', v); c.requestRenderAll(); capture(); sync(); }
  }
  function del() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { c.remove(o); c.requestRenderAll(); } }
  function front() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { (c as any).bringObjectToFront(o); c.requestRenderAll(); capture(); sync(); } }
  function back() { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { (c as any).sendObjectToBack(o); c.requestRenderAll(); capture(); sync(); } }
  function alignObj(dir: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    const w = typeof o.getScaledWidth === 'function' ? o.getScaledWidth() : (o.width || 0) * (o.scaleX || 1);
    const h = typeof o.getScaledHeight === 'function' ? o.getScaledHeight() : (o.height || 0) * (o.scaleY || 1);
    if (dir === 'left') o.set('left', 0);
    else if (dir === 'hcenter') o.set('left', (CW - w) / 2);
    else if (dir === 'right') o.set('left', CW - w);
    else if (dir === 'top') o.set('top', 0);
    else if (dir === 'vcenter') o.set('top', (CH - h) / 2);
    else if (dir === 'bottom') o.set('top', CH - h);
    o.setCoords(); c.requestRenderAll(); capture(); sync();
  }
  async function dupObj() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    try {
      const clone = await o.clone(['anim', 'shape', 'link']);
      clone.set({ left: (o.left || 0) + 20, top: (o.top || 0) + 20 });
      c.add(clone); c.setActiveObject(clone); c.requestRenderAll(); // object:added → capture + sync
    } catch { /* noop */ }
  }
  async function pasteObj() {
    const c = fabricRef.current; const src = clipboardRef.current; if (!c || !src) return;
    try {
      const clone = await src.clone(['anim', 'shape', 'link']);
      clone.set({ left: (src.left || 0) + 24, top: (src.top || 0) + 24 });
      c.add(clone); c.setActiveObject(clone); c.requestRenderAll();
    } catch { /* noop */ }
  }

  // Keyboard editing for the active object (nudge, delete, copy/paste, duplicate).
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const c = fabricRef.current; if (!c) return;
      const o = c.getActiveObject() as any;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (meta && k === 'v') { e.preventDefault(); pasteObj(); return; }
      if (!o || o.isEditing) return;
      if (meta && k === 'c') { clipboardRef.current = o; return; }
      if (meta && k === 'd') { e.preventDefault(); dupObj(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); c.remove(o); c.requestRenderAll(); capture(); sync(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') o.top -= step;
      else if (e.key === 'ArrowDown') o.top += step;
      else if (e.key === 'ArrowLeft') o.left -= step;
      else if (e.key === 'ArrowRight') o.left += step;
      else return;
      e.preventDefault(); o.setCoords(); c.requestRenderAll(); capture(); sync();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  function addSlide() { capture(); slidesRef.current.splice(cur + 1, 0, blank()); notesRef.current.splice(cur + 1, 0, ''); sync(); loadInto(cur + 1); }
  function dupSlide() { capture(); slidesRef.current.splice(cur + 1, 0, JSON.parse(JSON.stringify(slidesRef.current[cur]))); notesRef.current.splice(cur + 1, 0, notesRef.current[cur] ?? ''); sync(); loadInto(cur + 1); }
  function delSlide(i: number) { if (slidesRef.current.length === 1) return; slidesRef.current.splice(i, 1); notesRef.current.splice(i, 1); sync(); loadInto(Math.max(0, i <= cur ? cur - 1 : cur)); }
  function reorderSlides(from: number, to: number) {
    if (from === to) return;
    capture();
    const [m] = slidesRef.current.splice(from, 1); slidesRef.current.splice(to, 0, m);
    const [mn] = notesRef.current.splice(from, 1); notesRef.current.splice(to, 0, mn);
    sync(); loadInto(to);
  }

  return (
    <div className="flex flex-col gap-3 h-full p-3">
      <OfficeRibbon storageKey="ribbon:slides">
        {fileActions != null && (
          <RibbonTab id="file" label="Archivo" icon={FileText}>
            <RibbonGroup label="Presentación">{fileActions}</RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="home" label="Inicio">
            <RibbonGroup label="Diapositivas">
              <RibbonButton icon={Plus} label="Nueva diapositiva" onClick={addSlide} />
              <RibbonButton icon={Copy} label="Duplicar diapositiva" onClick={dupSlide} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Fuente">
              <RibbonSelect title="Fuente del texto" value="" placeholder="Fuente" width={120}
                onChange={(v) => { if (v) setTextFont(v); }}
                options={['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New', 'system-ui'].map((f) => ({ label: f, value: f }))} />
              <RibbonButton icon={PlusIcon} label="Aumentar tamaño de texto" onClick={() => fontSize(4)} />
              <RibbonButton icon={MinusIcon} label="Reducir tamaño de texto" onClick={() => fontSize(-4)} />
              <RibbonButton icon={Bold} label="Negrita" shortcut="Ctrl+B" onClick={toggleBold} />
              <RibbonButton icon={Italic} label="Cursiva" shortcut="Ctrl+I" onClick={toggleItalic} />
              <RibbonButton icon={Underline} label="Subrayado" shortcut="Ctrl+U" onClick={toggleUnderline} />
              <RibbonColorButton icon={PaintBucket} title="Color de relleno / texto" onChange={setColor} swatchBar={false} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Párrafo">
              <RibbonButton icon={AlignLeft} label="Alinear a la izquierda" onClick={() => setTextAlign('left')} />
              <RibbonButton icon={AlignCenter} label="Centrar texto" onClick={() => setTextAlign('center')} />
              <RibbonButton icon={AlignRight} label="Alinear a la derecha" onClick={() => setTextAlign('right')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Edición">
              <RibbonButton icon={CopyPlus} label="Duplicar elemento" shortcut="Ctrl+D" onClick={dupObj} />
              <RibbonButton icon={Trash2} label="Eliminar elemento" danger onClick={del} />
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="insert" label="Insertar">
            <RibbonGroup label="Texto">
              <RibbonButton icon={Type} label="Cuadro de texto" onClick={addText} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Ilustraciones">
              <label title="Imagen" className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 cursor-pointer">
                <ImagePlus className="w-[17px] h-[17px]" strokeWidth={1.75} /><input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
              <RibbonButton icon={Square} label="Rectángulo" onClick={addRect} />
              <RibbonButton icon={CircleIcon} label="Círculo" onClick={addCircle} />
              <RibbonButton icon={TriIcon} label="Triángulo" onClick={addTriangle} />
              <RibbonButton icon={Star} label="Estrella" onClick={addStar} />
              <RibbonButton icon={ArrowRight} label="Flecha" onClick={addArrow} />
              <RibbonButton icon={Diamond} label="Rombo" onClick={addDiamond} />
              <RibbonButton icon={Minus} label="Línea" onClick={addLine} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Vínculos">
              <RibbonButton icon={Link2} label="Hipervínculo" onClick={setObjLink} />
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="format" label="Formato">
            <RibbonGroup label="Organizar">
              <RibbonButton icon={ChevronsUp} label="Traer al frente" onClick={front} />
              <RibbonButton icon={ChevronsDown} label="Enviar atrás" onClick={back} />
              <RibbonButton icon={AlignHorizontalJustifyStart} label="Alinear a la izquierda" onClick={() => alignObj('left')} />
              <RibbonButton icon={AlignHorizontalJustifyCenter} label="Centrar horizontal" onClick={() => alignObj('hcenter')} />
              <RibbonButton icon={AlignHorizontalJustifyEnd} label="Alinear a la derecha" onClick={() => alignObj('right')} />
              <RibbonButton icon={AlignVerticalJustifyStart} label="Alinear arriba" onClick={() => alignObj('top')} />
              <RibbonButton icon={AlignVerticalJustifyCenter} label="Centrar vertical" onClick={() => alignObj('vcenter')} />
              <RibbonButton icon={AlignVerticalJustifyEnd} label="Alinear abajo" onClick={() => alignObj('bottom')} />
              <RibbonButton icon={FlipHorizontal} label="Voltear horizontal" onClick={() => flip('x')} />
              <RibbonButton icon={FlipVertical} label="Voltear vertical" onClick={() => flip('y')} />
              <RibbonButton icon={selLocked ? Unlock : Lock} label={selLocked ? 'Desbloquear posición' : 'Bloquear posición'} active={selLocked} onClick={toggleLock} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Estilo de forma">
              <RibbonColorButton icon={PaintBucket} title="Color de relleno" onChange={setColor} swatchBar={false} />
              <RibbonButton icon={Blend} label="Degradado" onClick={applyGradient} />
              <RibbonButton icon={Droplet} label="Sombra" onClick={toggleShadow} />
              {hasSel && (
                <span className="inline-flex items-center gap-1 px-1.5" title="Opacidad del objeto">
                  <input type="range" min={0.1} max={1} step={0.05} value={selOpacity}
                    onChange={(e) => { const v = Number(e.target.value); setSelOpacity(v); setOpacity(v); }}
                    className="w-20 accent-blue-500" />
                </span>
              )}
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Animación">
              {hasSel ? (
                <RibbonSelect title="Animación de entrada del objeto" value={selAnim} onChange={setObjAnim} width={150}
                  options={[
                    { label: 'Sin animación', value: 'none' },
                    { label: 'Aparecer', value: 'fade' },
                    { label: 'Entrar (abajo)', value: 'fly' },
                    { label: 'Zoom', value: 'zoom' },
                  ]} />
              ) : <span className="text-[11px] text-gray-400 px-2">Selecciona un objeto</span>}
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="transitions" label="Transiciones">
            <RibbonGroup label="Transición de diapositiva">
              <RibbonSelect title="Transición entre diapositivas" value={transition} onChange={setTrans} width={150}
                options={[
                  { label: 'Sin transición', value: 'none' },
                  { label: 'Fundido', value: 'fade' },
                  { label: 'Deslizar', value: 'slide' },
                  { label: 'Zoom', value: 'zoom' },
                ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Fondo">
              <RibbonColorButton icon={Palette} title="Fondo de todas las diapositivas" onChange={applyBgAll} swatchBar={false} />
            </RibbonGroup>
          </RibbonTab>
        )}

        <RibbonTab id="view" label="Vista">
          <RibbonGroup label="Presentación">
            <RibbonButton icon={Play} label="Presentar" hideLabel={false} onClick={() => { capture(); setPresenting(true); }} />
            <RibbonButton icon={LayoutGrid} label="Clasificador" hideLabel={false} onClick={() => { capture(); setSorter(true); }} />
          </RibbonGroup>
        </RibbonTab>
      </OfficeRibbon>

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

      {presenting && <Present slides={slides} notes={notesRef.current} transition={transition} onClose={() => setPresenting(false)} />}
      <AnimatePresence>
        {sorter && (
          <SlideSorter
            slides={slides}
            current={cur}
            onReorder={readOnly ? () => {} : reorderSlides}
            onDelete={readOnly ? () => {} : delSlide}
            onOpen={(i) => { setSorter(false); goto(i); }}
            onClose={() => setSorter(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const TRANSITIONS: Record<string, any> = {
  none: { initial: {}, animate: {}, exit: {} },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: { initial: { x: '100%', opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: '-100%', opacity: 0 } },
  zoom: { initial: { scale: 0.85, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.1, opacity: 0 } },
};
const OBJ_ANIM: Record<string, any> = {
  none: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  fly: { initial: { opacity: 0, y: '6%' }, animate: { opacity: 1, y: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
};

interface Deck { bg: string; layers: { src: string; anim: string }[] }

function Present({ slides, notes, transition, onClose }: { slides: any[]; notes?: string[]; transition?: string; onClose: () => void }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [i, setI] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const variant = TRANSITIONS[transition || 'fade'] ?? TRANSITIONS.fade;

  useEffect(() => {
    let active = true;
    (async () => {
      const out: Deck[] = [];
      for (const json of slides) {
        const layers: { src: string; anim: string }[] = [];
        for (const o of json?.objects ?? []) {
          try {
            const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: CH });
            await sc.loadFromJSON({ version: json.version, objects: [o] });
            sc.renderAll();
            layers.push({ src: sc.toDataURL({ format: 'png', multiplier: 1 } as any), anim: (o.anim as string) || 'none' });
            sc.dispose();
          } catch { /* skip object */ }
        }
        out.push({ bg: (json?.background as string) || '#ffffff', layers });
      }
      if (active) setDecks(out);
    })();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((v) => Math.min(slides.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
      if (e.key.toLowerCase() === 'n') setShowNotes((v) => !v);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => { active = false; window.removeEventListener('keydown', onKey); };
  }, [slides, onClose]);

  const note = notes?.[i]?.trim();
  const hasNotes = (notes ?? []).some((n) => n?.trim());
  const deck = decks[i];

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {hasNotes && (
          <button onClick={() => setShowNotes((v) => !v)} title="Notas del orador (N)" className={`p-2 rounded-full text-white transition-colors ${showNotes ? 'bg-amber-500/80' : 'bg-white/15 hover:bg-white/30'}`}><StickyNote className="w-5 h-5" /></button>
        )}
        <button onClick={onClose} title="Cerrar (Esc)" className="p-2 rounded-full bg-white/15 text-white hover:bg-white/30"><X className="w-5 h-5" /></button>
      </div>
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {!deck ? <div className="text-white/60">Generando…</div> : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={i} variants={variant} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="absolute" style={{ width: 'min(100vw, 177.78vh)', aspectRatio: '16 / 9', background: deck.bg }}>
              {deck.layers.map((L, j) => (
                <motion.img key={j} src={L.src} alt="" className="absolute inset-0 w-full h-full object-contain"
                  variants={OBJ_ANIM[L.anim] ?? OBJ_ANIM.none} initial="initial" animate="animate"
                  transition={{ duration: 0.5, ease: 'easeOut', delay: L.anim && L.anim !== 'none' ? 0.15 + j * 0.18 : 0 }} />
              ))}
              {(slides[i]?.objects ?? []).map((o: any, j: number) => {
                if (!o?.link) return null;
                const w = (o.radius ? o.radius * 2 : (o.width ?? 0)) * (o.scaleX ?? 1);
                const h = (o.radius ? o.radius * 2 : (o.height ?? 0)) * (o.scaleY ?? 1);
                const go = () => { if (o.link.type === 'slide') setI(Math.max(0, Math.min(slides.length - 1, o.link.index))); else if (o.link.href) window.open(o.link.href, '_blank', 'noopener'); };
                return <button key={`lnk${j}`} onClick={go} title="Ir al hipervínculo"
                  style={{ position: 'absolute', left: `${((o.left ?? 0) / CW) * 100}%`, top: `${((o.top ?? 0) / CH) * 100}%`, width: `${(w / CW) * 100}%`, height: `${(h / CH) * 100}%` }}
                  className="cursor-pointer hover:ring-2 ring-blue-400/60 rounded-sm" />;
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <button onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20 z-20">‹</button>
      <button onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))} disabled={i === slides.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20 z-20">›</button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm z-20">{i + 1} / {slides.length}</div>
      {showNotes && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[30%] overflow-y-auto bg-black/80 backdrop-blur border-t border-white/10 px-8 py-4 text-white/90 text-sm leading-relaxed whitespace-pre-wrap z-20">
          {note || <span className="text-white/40">Sin notas para esta diapositiva.</span>}
        </div>
      )}
    </div>
  );
}
