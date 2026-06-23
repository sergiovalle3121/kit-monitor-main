'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Canvas, StaticCanvas, Textbox, Rect, Circle, Line, Triangle, FabricImage, Polygon, Path, Shadow, Gradient,
  Group, ActiveSelection, PencilBrush, loadSVGFromString,
} from 'fabric';
import {
  Type, ImagePlus, Square, Circle as CircleIcon, Minus, Triangle as TriIcon,
  Trash2, ChevronsUp, ChevronsDown, Plus, Copy, Play, X, Bold, Plus as PlusIcon, Minus as MinusIcon,
  StickyNote, CopyPlus, LayoutGrid, Star, ArrowRight, Diamond, FileText, Palette, PaintBucket,
  Italic, Underline, AlignLeft, AlignCenter, AlignRight, Droplet, Blend, Link2, FlipHorizontal, FlipVertical, Lock, Unlock,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  LayoutTemplate, Table2, Grid3x3, Hash, SquareDashed, MonitorPlay, Brush,
  Shapes, Crop, SunMedium, Contrast, Wand2, Replace, RefreshCw, Group as GroupIcon, Ungroup, RotateCw,
  BarChart3, Workflow, Spline, Waypoints,
  List, IndentIncrease, IndentDecrease, MoveHorizontal, AlignVerticalSpaceAround, Sparkles, Search,
  Pointer, Pencil, Eraser, Moon, ListTree, Layers,
  ZoomIn, ZoomOut, Maximize, Scan, MousePointerClick, Check,
  AlignHorizontalSpaceAround, Paintbrush, Stamp, Proportions, FolderPlus, Squircle, Pipette, Move, PlayCircle,
  Repeat, Timer, Pause,
} from 'lucide-react';
import { SlideSorter } from './SlideSorter';
import { SlideIconPicker } from './SlideIconPicker';
import { TemplateGallery } from './TemplateGallery';
import { SLIDE_THEMES, SLIDE_LAYOUTS, SLIDE_TRANSITIONS, OBJ_ANIM_OPTIONS, OBJ_ANIM_START, DEFAULT_ANIM_START, animKind, SLIDE_RATIOS, slideHeight, TRANS_DURATIONS, DEFAULT_TRANS_DUR, themeHeading, type SlideTheme } from './slideAssets';
import { SlideAnimationPanel, type AnimItem } from './SlideAnimationPanel';
import { SlideLayersPanel, type LayerItem } from './SlideLayersPanel';
import { POLY_SHAPES, PATH_SHAPES } from './slides/shapes';
import { applyImageEffects, readImgFx, cropToRatio, resetCrop, CROP_RATIOS, type ImgFx } from './slides/imageEffects';
import { ShapeGallery } from './slides/ShapeGallery';
import { ImageEffectsPanel } from './slides/ImageEffectsPanel';
import { QUICK_STYLES } from './slides/quickStyles';
import { QuickStyleGallery } from './slides/QuickStyleGallery';
import { buildTableGroup, defaultTableSpec, isTable, type TableSpec } from './slides/table';
import { SlideTableEditor } from './SlideTableEditor';
import { PositionSizeForm } from './slides/PositionSizeForm';
import { makeBgRect, isBgFill, BG_PRESETS } from './slides/backgrounds';
import { BgGallery } from './slides/BgGallery';
import { buildChartGroup, defaultChartSpec, isChart, type ChartSpec } from './slides/chart';
import { SlideChartEditor } from './SlideChartEditor';
import { buildSmartArt, defaultSmartSpec, isSmart, type SmartSpec } from './slides/smartart';
import { SlideSmartArtEditor } from './SlideSmartArtEditor';
import { makeConnector, refreshConnectors, pickTwo, isConnector } from './slides/connectors';
import { SlideFindReplace } from './SlideFindReplace';
import { SlideOutline } from './SlideOutline';
import { SlideReusePanel, type ReuseItem } from './SlideReusePanel';
import {
  OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator,
  RibbonButton, RibbonSelect, RibbonColorButton, RibbonMenuButton,
} from './ribbon';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const CW = 960;

function blank() { return { version: '7', objects: [], background: '#ffffff' }; }
function labelOf(slide: any): string {
  const t = slide?.objects?.find((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  return (t?.text || '').split('\n')[0] || '';
}
function typeName(o: any): string {
  if (isChart(o)) return 'Gráfico';
  if (isSmart(o)) return 'SmartArt';
  if (isTable(o)) return 'Tabla';
  if (isConnector(o)) return 'Conector';
  const t = String(o?.type || '');
  if (t === 'image') return 'Imagen';
  if (t === 'textbox' || t === 'i-text' || t === 'text') return 'Texto';
  if (t === 'group') return 'Grupo';
  if (t === 'path') return 'Icono';
  return 'Forma';
}
function objLabel(o: any): string {
  if (isChart(o)) return o.chartSpec?.title || 'Gráfico';
  if (isSmart(o)) return `SmartArt · ${o.smart?.kind ?? ''}`;
  if (o?.type === 'textbox' || o?.type === 'i-text' || o?.type === 'text') return (String(o.text || '').split('\n')[0] || 'Texto').slice(0, 26);
  return typeName(o);
}

// ── Colores de tema (modelo «theme colors» tipo PowerPoint) ──────────────────
// Cambiar el tema reestiliza TODO el mazo: cualquier color literal que coincida
// con un slot del tema anterior (fondo/superficie/texto/atenuado/acento) se
// remapea al slot equivalente del tema nuevo. Los colores que el usuario eligió
// a mano (que no son del tema) se conservan intactos.
// Aclara un color hex mezclándolo con blanco (para degradados de un solo tono).
function lightenHex(hex: string, amt = 0.5): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
const THEME_SLOTS: (keyof SlideTheme)[] = ['bg', 'surface', 'text', 'muted', 'accent'];
function remapThemeColor(col: any, from: SlideTheme, to: SlideTheme): any {
  if (typeof col !== 'string') return col;
  const c = col.toLowerCase();
  for (const k of THEME_SLOTS) {
    const slot = from[k];
    if (typeof slot === 'string' && c === slot.toLowerCase()) return to[k];
  }
  return col;
}
function remapThemeObject(o: any, from: SlideTheme, to: SlideTheme): void {
  if (!o || typeof o !== 'object') return;
  for (const key of ['fill', 'stroke', 'backgroundColor'] as const) {
    const v = o[key];
    if (typeof v === 'string') o[key] = remapThemeColor(v, from, to);
    else if (v && typeof v === 'object' && Array.isArray(v.colorStops)) {
      v.colorStops = v.colorStops.map((s: any) => ({ ...s, color: remapThemeColor(s.color, from, to) }));
    }
  }
  // Tipografía: remapea cuerpo (font) y títulos (headingFont) del tema anterior
  // al nuevo, conservando fuentes que el usuario eligió a mano.
  if (typeof o.fontFamily === 'string') {
    const ff = o.fontFamily.toLowerCase();
    if (ff === from.font.toLowerCase()) o.fontFamily = to.font;
    else if (from.headingFont && ff === from.headingFont.toLowerCase()) o.fontFamily = themeHeading(to);
  }
  if (Array.isArray(o.objects)) for (const child of o.objects) remapThemeObject(child, from, to);
}
// Los marcadores de posición (placeholders, prop `ph`) siguen la tipografía del
// tema: título/subtítulo usan la fuente de títulos; el contenido, la de cuerpo.
// Así el cambio de tema reestiliza las fuentes de los placeholders de forma
// consistente (los cuadros de texto sueltos conservan su fuente manual).
function applyPlaceholderFont(o: any, t: SlideTheme): void {
  if (!o || typeof o !== 'object') return;
  if (o.ph === 'title' || o.ph === 'subtitle') o.fontFamily = themeHeading(t);
  else if (o.ph === 'body') o.fontFamily = t.font;
}

export function SlidesEditor({ value, onChange, readOnly, fileActions }: { value: any; onChange: (data: any) => void; readOnly?: boolean; fileActions?: React.ReactNode }) {
  const toast = useToast();
  const confirm = useConfirm();
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
  const initialSections: (string | null)[] = (() => {
    const s = Array.isArray(value?.sections) ? value.sections.slice(0, initial.length) : [];
    while (s.length < initial.length) s.push(null);
    return s;
  })();
  const initialTransitions: string[] = (() => {
    const t = Array.isArray(value?.transitions) ? value.transitions.slice(0, initial.length) : [];
    const def = value?.transition || 'fade';
    while (t.length < initial.length) t.push(def);
    return t;
  })();
  const initialTransDurs: number[] = (() => {
    const d = Array.isArray(value?.transDurs) ? value.transDurs.slice(0, initial.length) : [];
    while (d.length < initial.length) d.push(DEFAULT_TRANS_DUR);
    return d.map((x: any) => (typeof x === 'number' && x > 0 ? x : DEFAULT_TRANS_DUR));
  })();
  // Avance automático por diapositiva (segundos; 0 = sólo al hacer clic).
  const initialAdvance: number[] = (() => {
    const d = Array.isArray(value?.advanceAfters) ? value.advanceAfters.slice(0, initial.length) : [];
    while (d.length < initial.length) d.push(0);
    return d.map((x: any) => (typeof x === 'number' && x >= 0 ? x : 0));
  })();
  const slidesRef = useRef<any[]>(initial);
  const notesRef = useRef<string[]>(initialNotes);
  const sectionsRef = useRef<(string | null)[]>(initialSections);
  const transitionsRef = useRef<string[]>(initialTransitions);
  const transDursRef = useRef<number[]>(initialTransDurs);
  const advanceRef = useRef<number[]>(initialAdvance);
  const loopRef = useRef<boolean>(!!value?.loop);
  const [sections, setSections] = useState<(string | null)[]>(initialSections);
  const [slides, setSlides] = useState<any[]>(initial); // mirror for rendering
  const [cur, setCur] = useState(0);
  const [noteDraft, setNoteDraft] = useState<string>(initialNotes[0] ?? '');
  const [transition, setTransition] = useState<string>(initialTransitions[0] || 'fade');
  const transitionRef = useRef<string>(transition);
  const [transDur, setTransDur] = useState<number>(initialTransDurs[0] || DEFAULT_TRANS_DUR);
  const [advanceAfter, setAdvanceAfter] = useState<number>(initialAdvance[0] || 0);
  const [loop, setLoop] = useState<boolean>(!!value?.loop);
  const clipboardRef = useRef<any>(null);
  const [presenting, setPresenting] = useState(false);
  const [preview, setPreview] = useState(false); // vista previa de animación (una diapositiva)
  const presentStartRef = useRef(0);
  const [sorter, setSorter] = useState(false);
  const [selAnim, setSelAnim] = useState<string>('none');
  const [selAnimOrder, setSelAnimOrder] = useState(0);
  const [selAnimDur, setSelAnimDur] = useState(500);
  const [selAnimDelay, setSelAnimDelay] = useState(0);
  const [selAnimStart, setSelAnimStart] = useState<string>(DEFAULT_ANIM_START);
  const [showAnimPanel, setShowAnimPanel] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [selOpacity, setSelOpacity] = useState(1);
  const [selLocked, setSelLocked] = useState(false);
  const [hasSel, setHasSel] = useState(false);
  const [selType, setSelType] = useState<string>('');
  const [selCount, setSelCount] = useState(0);
  const [selAngle, setSelAngle] = useState(0);
  const [imgFx, setImgFx] = useState<ImgFx>(readImgFx(null));
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState('#ef4444');
  const [penWidth, setPenWidth] = useState(3);
  const [eyedropper, setEyedropper] = useState(false);
  const eyedropperRef = useRef(false);
  const eyedropperTargetRef = useRef<any>(null);
  const showGridRef = useRef(false);
  useEffect(() => { eyedropperRef.current = eyedropper; }, [eyedropper]);
  const [cropping, setCropping] = useState(false);
  const croppingRef = useRef(false);
  const cropRefs = useRef<{ img: any; frame: any } | null>(null);
  useEffect(() => { croppingRef.current = cropping; }, [cropping]);
  // Tema del mazo, cuadrícula, plantillas, pie/números de diapositiva.
  const [themeId, setThemeId] = useState<string>(value?.theme || 'light');
  const themeRef = useRef<string>(themeId);
  const [ratio, setRatio] = useState<string>(value?.ratio || '16:9');
  const ratioRef = useRef<string>(ratio);
  const ch = slideHeight(ratio);
  const [showGrid, setShowGrid] = useState(false);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  // Editor de gráfico: { spec } y si edita un objeto existente.
  const [chartEditor, setChartEditor] = useState<{ spec: ChartSpec; editing: boolean } | null>(null);
  const chartTargetRef = useRef<any>(null);
  const [smartEditor, setSmartEditor] = useState<{ spec: SmartSpec } | null>(null);
  const smartTargetRef = useRef<any>(null);
  const [tableEditor, setTableEditor] = useState<{ spec: TableSpec } | null>(null);
  const tableTargetRef = useRef<any>(null);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const findCursorRef = useRef<{ s: number; o: number }>({ s: -1, o: -1 });
  const [outlineOpen, setOutlineOpen] = useState(false);
  const footerRef = useRef<string>(value?.footer || '');
  const numbersRef = useRef<boolean>(!!value?.showNumbers);
  const [showNumbers, setShowNumbers] = useState<boolean>(!!value?.showNumbers);
  const theme = () => SLIDE_THEMES.find((t) => t.id === themeRef.current) || SLIDE_THEMES[0];
  // ── Patrón de diapositivas (slide master) ───────────────────────────────────
  // Modelo: un Fabric JSON con la «mobiliaria» compartida (logo, barras, marcos,
  // estilos de marcador) que se muestra detrás del contenido de TODAS las
  // diapositivas. Se edita en un modo dedicado; en modo normal se compone como
  // `backgroundImage` del lienzo (no se serializa por diapositiva).
  const masterRef = useRef<any>(value?.master && Array.isArray(value?.master?.objects) ? value.master : { version: '7', objects: [] });
  const masterModeRef = useRef(false);
  const masterImgRef = useRef<string>('');
  const [masterMode, setMasterMode] = useState(false);
  const [hasMaster, setHasMaster] = useState<boolean>(!!(value?.master?.objects?.length));

  useEffect(() => { curRef.current = cur; }, [cur]);

  function setObjAnim(v: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.set('anim', v === 'none' ? undefined : v);
    if (v !== 'none' && !o.animStart) { o.set('animStart', DEFAULT_ANIM_START); setSelAnimStart(DEFAULT_ANIM_START); }
    setSelAnim(v); capture(); sync();
  }
  function setObjAnimStart(v: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.set('animStart', v); setSelAnimStart(v); capture(); sync();
  }

  function sync() {
    setSlides([...slidesRef.current]);
    setSections([...sectionsRef.current]);
    onChange({ version: 2, slides: slidesRef.current, notes: notesRef.current, transition: transitionsRef.current[0] || 'fade', transitions: transitionsRef.current, transDurs: transDursRef.current, advanceAfters: advanceRef.current, loop: loopRef.current, theme: themeRef.current, footer: footerRef.current, showNumbers: numbersRef.current, ratio: ratioRef.current, sections: sectionsRef.current, master: masterRef.current });
  }
  function setTrans(t: string) { transitionsRef.current[curRef.current] = t; setTransition(t); transitionRef.current = t; sync(); }
  function setTransDuration(ms: number) { transDursRef.current[curRef.current] = ms; setTransDur(ms); sync(); }
  function setSlideAdvance(sec: number) { advanceRef.current[curRef.current] = Math.max(0, sec); setAdvanceAfter(Math.max(0, sec)); sync(); }
  function toggleLoop() { const v = !loopRef.current; loopRef.current = v; setLoop(v); sync(); }
  // «Aplicar a todas»: copia la transición, la duración Y el avance automático de
  // la diapositiva actual a todo el mazo (como PowerPoint).
  function applyTransAll(t: string) {
    const d = transDursRef.current[curRef.current] || DEFAULT_TRANS_DUR;
    const a = advanceRef.current[curRef.current] || 0;
    transitionsRef.current = transitionsRef.current.map(() => t);
    transDursRef.current = transDursRef.current.map(() => d);
    advanceRef.current = advanceRef.current.map(() => a);
    setTransition(t); transitionRef.current = t; setTransDur(d); setAdvanceAfter(a); sync();
  }
  function applyBgAll(color: string) {
    if (masterModeRef.current) return;
    capture();
    for (const s of slidesRef.current) s.background = color;
    const c = fabricRef.current; if (c) { c.backgroundColor = color; c.requestRenderAll(); }
    sync();
  }

  // ── Temas / layouts / tablas / iconos / efectos (profundidad PowerPoint) ────
  // Aplica el tema a TODO el mazo: remapea la paleta (fondo/texto/atenuado/
  // acento/superficie) y la tipografía del tema anterior al nuevo en cada
  // diapositiva, conservando los colores personalizados. Reestiliza títulos,
  // viñetas, barras de acento, formas y fondos creados a partir del tema.
  async function applyTheme(id: string) {
    if (masterModeRef.current) return;
    const to = SLIDE_THEMES.find((x) => x.id === id) || SLIDE_THEMES[0];
    const from = theme();
    capture();
    if (to.id !== from.id) {
      for (const s of slidesRef.current) {
        if (typeof s.background === 'string') s.background = remapThemeColor(s.background, from, to);
        for (const o of (s.objects || [])) { remapThemeObject(o, from, to); applyPlaceholderFont(o, to); }
      }
    }
    themeRef.current = id; setThemeId(id);
    await loadInto(curRef.current);
    sync();
  }
  async function applyLayout(id: string) {
    if (masterModeRef.current) return;
    const c = fabricRef.current; if (!c) return;
    const layout = SLIDE_LAYOUTS.find((l) => l.id === id); if (!layout) return;
    if (c.getObjects().length && !(await confirm({ message: 'Aplicar este diseño reemplazará el contenido de la diapositiva actual. ¿Continuar?', confirmLabel: 'Reemplazar' }))) return;
    const t = theme();
    loadingRef.current = true;
    c.getObjects().slice().forEach((o) => c.remove(o));
    for (const ph of layout.build()) {
      if (ph.kind === 'bar' || ph.kind === 'accentBar') {
        c.add(new Rect({ left: ph.left, top: ph.top, width: ph.width, height: ph.height || 8, fill: t.accent, rx: ph.kind === 'accentBar' ? 4 : 0, ry: ph.kind === 'accentBar' ? 4 : 0, ph: ph.kind } as any));
      } else {
        // Los marcadores de título/subtítulo usan la tipografía de títulos del
        // tema (mayor); el cuerpo usa la de cuerpo (menor). `ph` marca el rol.
        const heading = ph.kind === 'title' || ph.kind === 'subtitle';
        c.add(new Textbox(ph.text || '', { left: ph.left, top: ph.top, width: ph.width, fontSize: ph.fontSize || 28, fontWeight: ph.bold ? 'bold' : 'normal', fill: ph.muted ? t.muted : t.text, textAlign: ph.align || 'left', fontFamily: heading ? themeHeading(t) : t.font, ph: ph.kind } as any));
      }
    }
    c.backgroundColor = t.bg;
    loadingRef.current = false;
    c.requestRenderAll(); capture(); sync();
  }
  // ── Tablas estructuradas (Group con tableSpec; export nativo a .pptx) ───────
  function insertTable(rows: number, cols: number) {
    const c = fabricRef.current; if (!c) return;
    const t = theme();
    const g = buildTableGroup({ ...defaultTableSpec(rows, cols), accent: t.accent }, { text: t.text, font: t.font });
    c.add(g); c.setActiveObject(g); c.requestRenderAll(); capture(); sync();
  }
  function openTableEditor() { tableTargetRef.current = null; setTableEditor({ spec: defaultTableSpec(3, 3) }); }
  function editTableObj(g: any) { tableTargetRef.current = g; setTableEditor({ spec: g.tableSpec }); }
  function applyTable(spec: TableSpec) {
    const c = fabricRef.current; if (!c) { setTableEditor(null); return; }
    const t = theme();
    const old = tableTargetRef.current;
    const pos = old ? { left: old.left, top: old.top, scaleX: old.scaleX, scaleY: old.scaleY, angle: old.angle } : { left: 90, top: 150, scaleX: 1, scaleY: 1, angle: 0 };
    if (old) c.remove(old);
    const g = buildTableGroup({ ...spec, accent: t.accent }, { left: pos.left, top: pos.top, text: t.text, font: t.font });
    g.set({ scaleX: pos.scaleX || 1, scaleY: pos.scaleY || 1, angle: pos.angle || 0 });
    g.setCoords();
    c.add(g); c.setActiveObject(g); c.requestRenderAll();
    tableTargetRef.current = null; setTableEditor(null); capture(); sync();
  }
  // ── Gráficos desde datos (Group con chartSpec; export nativo a .pptx) ──────
  function openChartEditor() { chartTargetRef.current = null; setChartEditor({ spec: defaultChartSpec(), editing: false }); }
  function editChartObj(g: any) { chartTargetRef.current = g; setChartEditor({ spec: g.chartSpec, editing: true }); }
  function applyChart(spec: ChartSpec) {
    const c = fabricRef.current; if (!c) { setChartEditor(null); return; }
    const t = theme();
    const old = chartTargetRef.current;
    const pos = old
      ? { left: old.left, top: old.top, scaleX: old.scaleX, scaleY: old.scaleY, angle: old.angle }
      : { left: 240, top: 120, scaleX: 1, scaleY: 1, angle: 0 };
    if (old) c.remove(old);
    const g = buildChartGroup(spec, { left: pos.left, top: pos.top, text: t.text, font: t.font });
    g.set({ scaleX: pos.scaleX || 1, scaleY: pos.scaleY || 1, angle: pos.angle || 0 });
    g.setCoords();
    c.add(g); c.setActiveObject(g); c.requestRenderAll();
    chartTargetRef.current = null; setChartEditor(null);
    capture(); sync();
  }
  // ── SmartArt (Group con prop smart; export como formas reales en .pptx) ─────
  function openSmartEditor() { smartTargetRef.current = null; setSmartEditor({ spec: defaultSmartSpec() }); }
  function editSmartObj(g: any) { smartTargetRef.current = g; setSmartEditor({ spec: g.smart }); }
  function applySmart(spec: SmartSpec) {
    const c = fabricRef.current; if (!c) { setSmartEditor(null); return; }
    const t = theme();
    const old = smartTargetRef.current;
    const pos = old
      ? { left: old.left, top: old.top, scaleX: old.scaleX, scaleY: old.scaleY, angle: old.angle }
      : { left: 70, top: 130, scaleX: 1, scaleY: 1, angle: 0 };
    if (old) c.remove(old);
    const g = buildSmartArt(spec, { left: pos.left, top: pos.top, text: t.text, font: t.font });
    g.set({ scaleX: pos.scaleX || 1, scaleY: pos.scaleY || 1, angle: pos.angle || 0 });
    g.setCoords();
    c.add(g); c.setActiveObject(g); c.requestRenderAll();
    smartTargetRef.current = null; setSmartEditor(null);
    capture(); sync();
  }
  // ── Conectores anclados (se pegan a dos formas y se mueven con ellas) ───────
  function connect(arrow: boolean) {
    const c = fabricRef.current; if (!c) return;
    const sel = c.getActiveObject();
    const pair = pickTwo(sel); if (!pair) return;
    c.discardActiveObject(); // restaura coords absolutas de las formas
    const conn = makeConnector(pair[0], pair[1], arrow, theme().accent);
    c.add(conn); (c as any).sendObjectToBack?.(conn);
    c.requestRenderAll(); capture(); sync();
  }
  // ── Buscar y reemplazar en TODAS las diapositivas ──────────────────────────
  function reEsc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function isTextObj(o: any) { return o && (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text'); }
  function countMatches(q: string, cs: boolean): number {
    if (!q) return 0;
    const rx = new RegExp(reEsc(q), cs ? 'g' : 'gi'); let n = 0;
    for (const s of slidesRef.current) for (const o of s?.objects ?? []) if (isTextObj(o) && typeof o.text === 'string') n += (o.text.match(rx) || []).length;
    return n;
  }
  async function findNext(q: string, cs: boolean) {
    if (!q) return; capture();
    const rx = new RegExp(reEsc(q), cs ? 'g' : 'gi');
    const hits: { s: number; o: number }[] = [];
    slidesRef.current.forEach((s, si) => (s?.objects ?? []).forEach((o: any, oi: number) => { if (isTextObj(o) && typeof o.text === 'string' && rx.test(o.text)) hits.push({ s: si, o: oi }); }));
    if (!hits.length) return;
    const cur = findCursorRef.current;
    const next = hits.find((h) => h.s > cur.s || (h.s === cur.s && h.o > cur.o)) || hits[0];
    findCursorRef.current = next;
    if (next.s !== curRef.current) await loadInto(next.s);
    const c = fabricRef.current; if (!c) return;
    const obj = c.getObjects()[next.o];
    if (obj) { c.setActiveObject(obj); setHasSel(true); setSelType((obj as any).type || ''); c.requestRenderAll(); }
  }
  function setSlideTitle(i: number, text: string) {
    capture();
    const slide = slidesRef.current[i]; if (!slide) return;
    if (!Array.isArray(slide.objects)) slide.objects = [];
    const objs = slide.objects;
    const idx = objs.findIndex((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
    if (idx >= 0) { const lines = String(objs[idx].text ?? '').split('\n'); lines[0] = text; objs[idx].text = lines.join('\n'); }
    else objs.unshift({ type: 'textbox', version: '7', text, left: 60, top: 56, width: 760, fontSize: 40, fontWeight: 'bold', fill: '#111827', fontFamily: 'sans-serif' });
    if (i === curRef.current) loadInto(i);
    sync();
  }
  function replaceAllText(q: string, repl: string, cs: boolean): number {
    if (!q) return 0; capture();
    const rx = new RegExp(reEsc(q), cs ? 'g' : 'gi'); let n = 0;
    for (const s of slidesRef.current) for (const o of s?.objects ?? []) if (isTextObj(o) && typeof o.text === 'string') { o.text = o.text.replace(rx, () => { n++; return repl; }); }
    if (n) { loadInto(curRef.current); sync(); }
    return n;
  }
  // ── Texto pro: interlineado, espaciado, viñetas, niveles, contorno, WordArt ─
  function setLineHeight(v: number) { textSet((o) => o.set('lineHeight', v)); }
  function changeCharSpacing(delta: number) { textSet((o) => o.set('charSpacing', Math.max(-200, (o.charSpacing || 0) + delta))); }
  function toggleBullets() {
    textSet((o) => {
      const lines = String(o.text || '').split('\n');
      const allBul = lines.every((l) => l.trim() === '' || /^\s*•\s/.test(l));
      o.set('text', lines.map((l) => {
        if (l.trim() === '') return l;
        const indent = l.match(/^\s*/)?.[0] ?? '';
        return allBul ? l.replace(/^(\s*)•\s/, '$1') : `${indent}• ${l.slice(indent.length)}`;
      }).join('\n'));
    });
  }
  function indentLevel(delta: number) {
    textSet((o) => {
      const lines = String(o.text || '').split('\n');
      o.set('text', lines.map((l) => {
        if (delta > 0) return `  ${l}`;
        return l.replace(/^ {1,2}/, '');
      }).join('\n'));
    });
  }
  function toggleTextOutline() {
    textSet((o) => {
      if (o.stroke && o.strokeWidth) o.set({ stroke: null, strokeWidth: 0 });
      else o.set({ stroke: theme().accent, strokeWidth: 1.2, paintFirst: 'stroke', strokeLineJoin: 'round' });
    });
  }
  function applyWordArt(preset: 'gradient' | 'outline' | 'shadow') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !isText(o)) return;
    o.set('fontWeight', 'bold');
    if (preset === 'gradient') {
      const w = (o.width || 240) * (o.scaleX || 1);
      o.set('fill', new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: w, y2: 0 }, colorStops: [{ offset: 0, color: theme().accent }, { offset: 1, color: '#7c3aed' }] }));
      o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 2, offsetY: 3 }));
    } else if (preset === 'outline') {
      o.set({ stroke: theme().accent, strokeWidth: 1.4, paintFirst: 'stroke', strokeLineJoin: 'round' });
    } else {
      o.set('shadow', new Shadow({ color: 'rgba(0,0,0,0.45)', blur: 10, offsetX: 3, offsetY: 4 }));
    }
    c.requestRenderAll(); capture(); sync();
  }
  async function addIcon(svg: string) {
    const c = fabricRef.current; if (!c) return;
    try {
      const r: any = await loadSVGFromString(svg);
      const objs = (r?.objects || []).filter(Boolean);
      if (!objs.length) return;
      const obj: any = objs.length === 1 ? objs[0] : new Group(objs);
      obj.set({ left: 420, top: 220 });
      if (typeof obj.scaleToWidth === 'function') obj.scaleToWidth(120);
      c.add(obj); c.setActiveObject(obj); c.requestRenderAll();
    } catch { /* noop */ }
  }
  // ── Contorno de forma (grosor / estilo de línea / color), tipo PowerPoint ────
  function setOutlineWidth(w: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    if (w <= 0) o.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
    else { if (!o.stroke) o.set('stroke', theme().accent); o.set({ strokeWidth: w, paintFirst: 'stroke', strokeLineJoin: 'round' }); }
    c.requestRenderAll(); capture(); sync();
  }
  function setOutlineDash(kind: 'solid' | 'dashed' | 'dotted') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    if (!o.stroke || !o.strokeWidth) o.set({ stroke: theme().accent, strokeWidth: 2, paintFirst: 'stroke' });
    const w = o.strokeWidth || 2;
    o.set('strokeDashArray', kind === 'solid' ? null : kind === 'dashed' ? [w * 3, w * 2] : [Math.max(1, w * 0.1), w * 1.6]);
    o.set('strokeLineCap', kind === 'dotted' ? 'round' : 'butt');
    c.requestRenderAll(); capture(); sync();
  }
  function setOutlineColor(color: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.set('stroke', color); if (!o.strokeWidth) o.set({ strokeWidth: 2, paintFirst: 'stroke' });
    c.requestRenderAll(); capture(); sync();
  }
  function applyQuickStyle(id: string) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    const st = QUICK_STYLES.find((s) => s.id === id); if (!st) return;
    st.apply(o, theme().accent); c.requestRenderAll(); capture(); sync();
  }
  function resetFormat() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any; if (!c || !o) return;
    o.set({ shadow: null, stroke: null, strokeWidth: 0, opacity: 1, paintFirst: 'fill' });
    if (isText(o)) o.set({ fontWeight: 'normal', fontStyle: 'normal', underline: false, charSpacing: 0, lineHeight: 1.16, fill: theme().text });
    else if (o.type !== 'image' && o.type !== 'group') o.set('fill', theme().accent);
    c.requestRenderAll(); capture(); sync();
  }
  function startEyedropper() {
    const c = fabricRef.current; const o = c?.getActiveObject();
    if (!c || !o) { toast.info('Selecciona primero la forma o el texto a colorear.'); return; }
    eyedropperTargetRef.current = o; eyedropperRef.current = true; setEyedropper(true);
    c.defaultCursor = 'crosshair';
  }
  // Esquinas redondeadas (rectángulos): 0 = rectas; 'pill' = píldora.
  function setCorners(r: number | 'pill') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o || o.type !== 'rect') return;
    const radius = r === 'pill' ? (Math.min(o.width, o.height) / 2) : r;
    o.set({ rx: radius, ry: radius }); c.requestRenderAll(); capture(); sync();
  }
  // ── Dibujo libre (lápiz) en el lienzo ───────────────────────────────────────
  function toggleDraw() {
    const c = fabricRef.current; if (!c) return;
    const next = !drawMode; c.isDrawingMode = next;
    if (next) { const b = new PencilBrush(c); b.color = penColor; b.width = penWidth; c.freeDrawingBrush = b; }
    setDrawMode(next);
  }
  function setBrush(patch: { color?: string; width?: number }) {
    if (patch.color !== undefined) setPenColor(patch.color);
    if (patch.width !== undefined) setPenWidth(patch.width);
    const b: any = fabricRef.current?.freeDrawingBrush;
    if (b) { if (patch.color !== undefined) b.color = patch.color; if (patch.width !== undefined) b.width = patch.width; }
  }
  // Fondo sólo de la diapositiva actual.
  function applyBgCurrent(color: string) {
    const c = fabricRef.current; if (!c || masterModeRef.current) return;
    capture(); slidesRef.current[curRef.current].background = color;
    c.backgroundColor = color; c.requestRenderAll(); sync();
  }
  // Fondo de degradado (Rect a sangre completa, bloqueado, al fondo).
  function applyBgPreset(id: string, all: boolean) {
    const c = fabricRef.current; if (!c || masterModeRef.current) return;
    const preset = BG_PRESETS.find((p) => p.id === id); if (!preset) return;
    capture();
    c.getObjects().filter((o: any) => isBgFill(o)).forEach((o) => c.remove(o));
    const rect = makeBgRect(preset, CW, ch);
    c.add(rect); (c as any).sendObjectToBack(rect); c.requestRenderAll();
    capture();
    if (all) {
      const json = (rect as any).toObject(['bgFill']);
      slidesRef.current.forEach((s: any, i: number) => {
        if (i === curRef.current) return;
        if (!Array.isArray(s.objects)) s.objects = [];
        s.objects = s.objects.filter((o: any) => !o.bgFill);
        s.objects.unshift(JSON.parse(JSON.stringify(json)));
      });
    }
    sync();
  }
  // Imagen de fondo (a sangre completa, modo «cubrir») de la diapositiva actual.
  function onBgImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f || masterModeRef.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      FabricImage.fromURL(reader.result, { crossOrigin: 'anonymous' }).then((img: any) => {
        const c = fabricRef.current; if (!c || !img) return;
        capture();
        c.getObjects().filter((o: any) => isBgFill(o)).forEach((o) => c.remove(o));
        const sc = Math.max(CW / (img.width || CW), ch / (img.height || ch));
        img.set({ left: 0, top: 0, scaleX: sc, scaleY: sc, selectable: false, evented: false, hoverCursor: 'default', bgFill: true });
        c.add(img); (c as any).sendObjectToBack(img); c.requestRenderAll(); capture(); sync();
      }).catch(() => {});
    };
    reader.readAsDataURL(f);
  }
  function removeBgFill(all: boolean) {
    const c = fabricRef.current; if (!c || masterModeRef.current) return;
    capture();
    c.getObjects().filter((o: any) => isBgFill(o)).forEach((o) => c.remove(o));
    c.requestRenderAll(); capture();
    if (all) slidesRef.current.forEach((s: any) => { if (Array.isArray(s.objects)) s.objects = s.objects.filter((o: any) => !o.bgFill); });
    sync();
  }
  function setObjAnimOrder(v: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return; o.set('animOrder', v); setSelAnimOrder(v); capture(); sync();
  }
  function setObjAnimDur(v: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return; o.set('animDur', v); setSelAnimDur(v); capture(); sync();
  }
  function setObjAnimDelay(v: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return; o.set('animDelay', v); setSelAnimDelay(v); capture(); sync();
  }
  // Cambia una propiedad de animación por índice de objeto (panel de animación).
  function setAnimByIndex(idx: number, key: 'anim' | 'animOrder' | 'animDur' | 'animDelay' | 'animStart', value: any) {
    const c = fabricRef.current; if (!c) return;
    const o = c.getObjects()[idx] as any; if (!o) return;
    o.set(key, key === 'anim' && value === 'none' ? undefined : value);
    if (key === 'anim' && value !== 'none' && !o.animStart) o.set('animStart', DEFAULT_ANIM_START);
    if (c.getActiveObject() === o) {
      if (key === 'anim') setSelAnim(value); if (key === 'animOrder') setSelAnimOrder(value);
      if (key === 'animDur') setSelAnimDur(value); if (key === 'animDelay') setSelAnimDelay(value);
      if (key === 'animStart') setSelAnimStart(value);
    }
    c.requestRenderAll(); capture(); sync();
  }
  function selectByIndex(idx: number) {
    const c = fabricRef.current; if (!c) return;
    const o = c.getObjects()[idx] as any; if (!o || o.visible === false) return;
    c.setActiveObject(o); c.requestRenderAll();
    setHasSel(true); setSelType(o.type || '');
  }
  // ── Panel de selección (capas) ──────────────────────────────────────────────
  function toggleVisibleIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx] as any; if (!o) return;
    o.visible = o.visible === false; if (o.visible === false && c.getActiveObject() === o) c.discardActiveObject();
    c.requestRenderAll(); capture(); sync();
  }
  function toggleLockIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx] as any; if (!o) return;
    o.locked = !o.locked; applyLock(o); if (c.getActiveObject() === o) setSelLocked(!!o.locked);
    c.requestRenderAll(); capture(); sync();
  }
  function forwardIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx]; if (!o) return;
    (c as any).bringObjectForward(o); c.requestRenderAll(); capture(); sync();
  }
  function backwardIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx]; if (!o) return;
    (c as any).sendObjectBackwards(o); c.requestRenderAll(); capture(); sync();
  }
  function frontIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx]; if (!o) return;
    (c as any).bringObjectToFront(o); c.requestRenderAll(); capture(); sync();
  }
  function backIdx(idx: number) {
    const c = fabricRef.current; if (!c) return; const o = c.getObjects()[idx]; if (!o) return;
    (c as any).sendObjectToBack(o); c.requestRenderAll(); capture(); sync();
  }
  // Reordena el orden Z arrastrando en el panel de selección (mueve `from`→`to`
  // un paso a la vez usando la API confirmada de Fabric).
  function reorderObject(from: number, to: number) {
    const c = fabricRef.current; if (!c || from === to) return;
    const o = c.getObjects()[from]; if (!o) return;
    const n = to - from;
    for (let i = 0; i < Math.abs(n); i++) { if (n > 0) (c as any).bringObjectForward(o); else (c as any).sendObjectBackwards(o); }
    c.requestRenderAll(); capture(); sync();
  }
  function toggleNumbers() { const v = !numbersRef.current; numbersRef.current = v; setShowNumbers(v); sync(); }
  function editFooter() {
    const v = window.prompt('Texto del pie de diapositiva (vacío = quitar)', footerRef.current);
    if (v === null) return; footerRef.current = v.trim(); sync();
  }
  async function applyTemplate(content: any) {
    setShowTemplates(false);
    if (masterModeRef.current) return;
    if (!content || content.version !== 2 || !Array.isArray(content.slides) || !content.slides.length) return;
    capture();
    slidesRef.current = content.slides;
    notesRef.current = Array.isArray(content.notes) ? content.notes.slice() : content.slides.map(() => '');
    while (notesRef.current.length < slidesRef.current.length) notesRef.current.push('');
    sectionsRef.current = content.slides.map(() => null);
    transitionsRef.current = Array.isArray(content.transitions) ? content.transitions.slice() : content.slides.map(() => content.transition || 'fade');
    while (transitionsRef.current.length < slidesRef.current.length) transitionsRef.current.push('fade');
    transDursRef.current = Array.isArray(content.transDurs) ? content.transDurs.slice() : content.slides.map(() => DEFAULT_TRANS_DUR);
    while (transDursRef.current.length < slidesRef.current.length) transDursRef.current.push(DEFAULT_TRANS_DUR);
    advanceRef.current = Array.isArray(content.advanceAfters) ? content.advanceAfters.slice() : content.slides.map(() => 0);
    while (advanceRef.current.length < slidesRef.current.length) advanceRef.current.push(0);
    { const tr = transitionsRef.current[0] || 'fade'; transitionRef.current = tr; setTransition(tr); setTransDur(transDursRef.current[0] || DEFAULT_TRANS_DUR); }
    setCur(0); curRef.current = 0;
    await loadInto(0);
    sync();
  }
  // Include custom props (anim = entrance animation, shape = .pptx mapping, link = hyperlink, locked).
  function capture() {
    const c = fabricRef.current; if (!c) return;
    const data: any = c.toObject(['anim', 'animOrder', 'animDur', 'animDelay', 'animStart', 'shape', 'link', 'locked', 'imgFx', 'chartSpec', 'smart', 'tableSpec', 'conn', 'connId', 'bgFill', 'ph']);
    // El patrón se compone como backgroundImage en modo normal: no debe quedar
    // guardado dentro del JSON de la diapositiva.
    delete data.backgroundImage; delete data.overlayImage;
    if (masterModeRef.current) masterRef.current = data;
    else slidesRef.current[curRef.current] = data;
  }
  // Renderiza el patrón a una imagen PNG transparente (mobiliaria compartida).
  async function renderMasterImage() {
    const m = masterRef.current;
    setHasMaster(!!(m?.objects?.length));
    if (!m?.objects?.length) { masterImgRef.current = ''; return; }
    try {
      const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: slideHeight(ratioRef.current) });
      await sc.loadFromJSON(m);
      sc.backgroundColor = ''; sc.renderAll();
      masterImgRef.current = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
      sc.dispose();
    } catch { masterImgRef.current = ''; }
  }
  // Aplica (o quita) el patrón como backgroundImage del lienzo actual.
  async function applyMasterBg() {
    const c = fabricRef.current; if (!c) return;
    if (masterModeRef.current || !masterImgRef.current) { c.backgroundImage = undefined as any; c.requestRenderAll(); return; }
    try {
      const mImg: any = await FabricImage.fromURL(masterImgRef.current);
      mImg.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false });
      mImg.scaleX = CW / (mImg.width || CW); mImg.scaleY = slideHeight(ratioRef.current) / (mImg.height || 1);
      c.backgroundImage = mImg; c.requestRenderAll();
    } catch { c.backgroundImage = undefined as any; }
  }
  async function enterMasterMode() {
    if (masterModeRef.current) return;
    const c = fabricRef.current; if (!c) return;
    capture();
    masterModeRef.current = true; setMasterMode(true);
    loadingRef.current = true;
    c.discardActiveObject(); setHasSel(false);
    c.getObjects().slice().forEach((o) => c.remove(o));
    c.backgroundImage = undefined as any;
    try {
      await c.loadFromJSON(masterRef.current);
      c.backgroundColor = theme().bg;
      if (readOnly) c.forEachObject((o: any) => { o.selectable = false; o.evented = false; });
    } catch { /* noop */ }
    loadingRef.current = false; c.requestRenderAll();
  }
  async function exitMasterMode() {
    if (!masterModeRef.current) return;
    capture();
    masterModeRef.current = false; setMasterMode(false);
    await renderMasterImage();
    await loadInto(curRef.current);
    sync();
  }
  function clearMaster() {
    masterRef.current = { version: '7', objects: [] };
    masterImgRef.current = ''; setHasMaster(false);
    const c = fabricRef.current;
    if (masterModeRef.current && c) { loadingRef.current = true; c.getObjects().slice().forEach((o) => c.remove(o)); loadingRef.current = false; c.requestRenderAll(); }
    else if (c) { c.backgroundImage = undefined as any; c.requestRenderAll(); }
    sync();
  }
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
    const canvas = new Canvas(elRef.current, { width: CW, height: ch, backgroundColor: '#ffffff', preserveObjectStacking: true });
    fabricRef.current = canvas;
    const onMod = () => { if (loadingRef.current) return; capture(); sync(); };
    canvas.on('object:added', onMod);
    canvas.on('object:modified', onMod);
    canvas.on('object:removed', onMod);
    const onSel = () => {
      const o = canvas.getActiveObject() as any;
      setHasSel(!!o); setSelType((o?.type as string) || '');
      setSelCount(o?.type === 'activeselection' || o?.type === 'activeSelection' ? (o._objects?.length ?? 0) : (o ? 1 : 0));
      setSelAnim((o?.anim as string) || 'none'); setSelAnimOrder(o?.animOrder ?? 0); setSelAnimDur(o?.animDur ?? 500); setSelAnimDelay(o?.animDelay ?? 0); setSelAnimStart((o?.animStart as string) || DEFAULT_ANIM_START);
      setSelOpacity(o?.opacity ?? 1); setSelLocked(!!o?.locked); setImgFx(readImgFx(o)); setSelAngle(Math.round(o?.angle ?? 0));
    };
    canvas.on('selection:created', onSel);
    canvas.on('selection:updated', onSel);
    canvas.on('selection:cleared', () => { setHasSel(false); setSelType(''); setSelCount(0); setSelAnim('none'); });
    // Doble clic en un gráfico o SmartArt → reabre su editor.
    canvas.on('mouse:dblclick', (e: any) => { const o = e?.target; if (readOnly) return; if (isChart(o)) editChartObj(o); else if (isSmart(o)) editSmartObj(o); else if (isTable(o)) editTableObj(o); });
    // Conectores anclados: recalcular al mover/escalar/rotar formas.
    const reconn = () => { try { refreshConnectors(canvas); } catch { /* noop */ } };
    canvas.on('object:moving', reconn);
    canvas.on('object:scaling', reconn);
    canvas.on('object:rotating', reconn);

    // Guías inteligentes + snapping (tipo PowerPoint): engancha los bordes
    // izquierdo/centro/derecho y superior/medio/inferior del objeto que se mueve
    // a los bordes y centro del lienzo Y a los bordes/centros de los demás
    // objetos. Dibuja las guías rosas en `after:render`.
    const SNAP = 7;
    let guides: { v: number[]; h: number[] } = { v: [], h: [] };
    canvas.on('object:moving', (e: any) => {
      const o = e.target; if (!o) return;
      guides = { v: [], h: [] };
      const H = slideHeight(ratioRef.current);
      o.setCoords();
      const r = o.getBoundingRect();
      // Anclas del objeto que se mueve (izq/centro/der · arr/medio/aba).
      const ax = [r.left, r.left + r.width / 2, r.left + r.width];
      const ay = [r.top, r.top + r.height / 2, r.top + r.height];
      // Objetivos: lienzo + cada otro objeto (excluye sus propios miembros y fondos).
      const members: any[] = Array.isArray((o as any)._objects) ? (o as any)._objects : [];
      const xs = [0, CW / 2, CW]; const ys = [0, H / 2, H];
      for (const other of canvas.getObjects()) {
        if (other === o || members.includes(other) || (other as any).visible === false || isBgFill(other)) continue;
        const b = (other as any).getBoundingRect();
        xs.push(b.left, b.left + b.width / 2, b.left + b.width);
        ys.push(b.top, b.top + b.height / 2, b.top + b.height);
      }
      // Mejor enganche por eje = menor distancia entre cualquier ancla y objetivo.
      let bx: { at: number; d: number; delta: number } | null = null;
      for (const a of ax) for (const tx of xs) { const d = Math.abs(a - tx); if (d <= SNAP && (!bx || d < bx.d)) bx = { at: tx, d, delta: tx - a }; }
      let by: { at: number; d: number; delta: number } | null = null;
      for (const a of ay) for (const ty of ys) { const d = Math.abs(a - ty); if (d <= SNAP && (!by || d < by.d)) by = { at: ty, d, delta: ty - a }; }
      if (bx) { o.set('left', o.left + bx.delta); guides.v.push(bx.at); }
      else if (showGridRef.current) { const G = 48; o.set('left', Math.round(o.left / G) * G); }
      if (by) { o.set('top', o.top + by.delta); guides.h.push(by.at); }
      else if (showGridRef.current) { const G = 48; o.set('top', Math.round(o.top / G) * G); }
      o.setCoords();
    });
    // Cuentagotas: muestrea el color del píxel bajo el cursor y lo aplica.
    canvas.on('mouse:down', (opt: any) => {
      if (!eyedropperRef.current) return;
      const target = eyedropperTargetRef.current; const ev = opt.e as MouseEvent;
      eyedropperRef.current = false; setEyedropper(false); canvas.defaultCursor = 'default';
      try {
        const el = (canvas as any).lowerCanvasEl as HTMLCanvasElement;
        const rect = el.getBoundingClientRect();
        const bx = Math.round(((ev.clientX - rect.left) / rect.width) * el.width);
        const by = Math.round(((ev.clientY - rect.top) / rect.height) * el.height);
        const ctx2 = el.getContext('2d'); if (!ctx2) return;
        const d = ctx2.getImageData(bx, by, 1, 1).data;
        const hexv = `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
        if (target) { target.set(target.type === 'line' ? 'stroke' : 'fill', hexv); canvas.requestRenderAll(); capture(); sync(); }
      } catch { toast.error('No se pudo muestrear el color (imagen externa sin CORS).'); }
    });
    const clearGuides = () => { if (guides.v.length || guides.h.length) { guides = { v: [], h: [] }; canvas.requestRenderAll(); } };
    canvas.on('mouse:up', clearGuides);
    canvas.on('after:render', () => {
      if (!guides.v.length && !guides.h.length) return;
      const ctx = ((canvas as any).contextContainer || (canvas as any).getContext?.()) as CanvasRenderingContext2D | undefined;
      if (!ctx) return;
      ctx.save(); ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      const H = slideHeight(ratioRef.current);
      for (const x of guides.v) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (const y of guides.h) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
      ctx.restore();
    });

    (async () => { await renderMasterImage(); await loadInto(0); })();
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
      c.forEachObject((o: any) => {
        if (o.type === 'image' && o.imgFx) applyImageEffects(o, readImgFx(o));
        if (isConnector(o)) { o.objectCaching = false; o.lockMovementX = true; o.lockMovementY = true; o.hasControls = false; }
        if (isBgFill(o)) { o.selectable = false; o.evented = false; o.hoverCursor = 'default'; }
      });
      if (readOnly) {
        c.selection = false;
        c.forEachObject((o: any) => { o.selectable = false; o.evented = false; });
      } else {
        c.forEachObject((o: any) => { if (o.locked) applyLock(o); });
      }
      try { refreshConnectors(c); } catch { /* noop */ }
      // Compone el patrón (mobiliaria compartida) detrás del contenido.
      if (!masterModeRef.current && masterImgRef.current) {
        try {
          const mImg: any = await FabricImage.fromURL(masterImgRef.current);
          mImg.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false });
          mImg.scaleX = CW / (mImg.width || CW); mImg.scaleY = slideHeight(ratioRef.current) / (mImg.height || 1);
          c.backgroundImage = mImg;
        } catch { c.backgroundImage = undefined as any; }
      } else { c.backgroundImage = undefined as any; }
      c.requestRenderAll();
    } catch { /* noop */ }
    loadingRef.current = false;
    curRef.current = i;
    setCur(i);
    setNoteDraft(notesRef.current[i] ?? '');
    const tr = transitionsRef.current[i] ?? 'fade'; setTransition(tr); transitionRef.current = tr;
    setTransDur(transDursRef.current[i] ?? DEFAULT_TRANS_DUR);
    setAdvanceAfter(advanceRef.current[i] ?? 0);
    setSlides([...slidesRef.current]);
  }
  function onNote(v: string) { setNoteDraft(v); notesRef.current[curRef.current] = v; sync(); }
  function goto(i: number) { if (masterModeRef.current) return; capture(); loadInto(i); }

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
  // Biblioteca ampliada de formas (polígonos + curvas) con pista para .pptx.
  function addShapeByKind(kind: string) {
    const fill = theme().accent;
    if (POLY_SHAPES[kind]) {
      const pts = POLY_SHAPES[kind].map((p) => ({ x: p.x * 1.6, y: p.y * 1.6 }));
      add(new Polygon(pts, { left: 300, top: 170, fill, shape: kind } as any));
    } else if (PATH_SHAPES[kind]) {
      const def = PATH_SHAPES[kind];
      const obj = new Path(def.d, { left: 300, top: 170, fill, shape: kind } as any);
      if (typeof (obj as any).scaleToWidth === 'function') (obj as any).scaleToWidth(180);
      add(obj);
    }
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
  // ── Efectos de imagen (filtros Fabric), recorte y reemplazo ────────────────
  const activeImage = (): any => { const o = fabricRef.current?.getActiveObject() as any; return o && o.type === 'image' ? o : null; };
  function setFx(patch: Partial<ImgFx>) {
    const c = fabricRef.current; const o = activeImage(); if (!c || !o) return;
    const next = { ...readImgFx(o), ...patch };
    setImgFx(next); applyImageEffects(o, next); c.requestRenderAll(); capture(); sync();
  }
  function resetFx() {
    const c = fabricRef.current; const o = activeImage(); if (!c || !o) return;
    applyImageEffects(o, readImgFx(null)); setImgFx(readImgFx(null)); c.requestRenderAll(); capture(); sync();
  }
  function cropImage(ratio: number) {
    const c = fabricRef.current; const o = activeImage(); if (!c || !o) return;
    cropToRatio(o, ratio); c.requestRenderAll(); capture(); sync();
  }
  function uncropImage() {
    const c = fabricRef.current; const o = activeImage(); if (!c || !o) return;
    resetCrop(o); c.requestRenderAll(); capture(); sync();
  }
  // ── Recorte interactivo: marco arrastrable sobre la imagen ──────────────────
  function startCrop() {
    const c = fabricRef.current; const img = activeImage(); if (!c || !img) return;
    img.set({ angle: 0 }); img.setCoords();
    const L = img.left, T = img.top, W = img.getScaledWidth(), H = img.getScaledHeight();
    const frame: any = new Rect({
      left: L, top: T, width: W, height: H, fill: 'rgba(59,130,246,0.10)', stroke: '#3b82f6', strokeWidth: 2,
      strokeDashArray: [7, 4], cornerColor: '#3b82f6', cornerStyle: 'circle', transparentCorners: false, lockRotation: true,
    } as any);
    frame.setControlsVisibility?.({ mtr: false });
    const iBounds = () => ({ l: img.left, t: img.top, r: img.left + img.getScaledWidth(), b: img.top + img.getScaledHeight() });
    frame.on('moving', () => {
      const B = iBounds();
      frame.left = Math.max(B.l, Math.min(frame.left, B.r - frame.getScaledWidth()));
      frame.top = Math.max(B.t, Math.min(frame.top, B.b - frame.getScaledHeight()));
    });
    img.selectable = false; img.evented = false;
    cropRefs.current = { img, frame };
    c.add(frame); c.setActiveObject(frame); c.requestRenderAll();
    setCropping(true);
  }
  function applyCropFrame() {
    const c = fabricRef.current; const refs = cropRefs.current; if (!c || !refs) { setCropping(false); return; }
    const { img, frame } = refs;
    const sX = img.scaleX || 1, sY = img.scaleY || 1;
    const iL = img.left, iT = img.top, iR = iL + img.getScaledWidth(), iB = iT + img.getScaledHeight();
    const fL = Math.max(iL, frame.left), fT = Math.max(iT, frame.top);
    const fR = Math.min(iR, frame.left + frame.getScaledWidth()), fB = Math.min(iB, frame.top + frame.getScaledHeight());
    c.remove(frame); img.selectable = true; img.evented = true; cropRefs.current = null; setCropping(false);
    if (fR - fL < 6 || fB - fT < 6) { c.setActiveObject(img); c.requestRenderAll(); return; }
    img.set({
      cropX: (img.cropX || 0) + (fL - iL) / sX,
      cropY: (img.cropY || 0) + (fT - iT) / sY,
      width: (fR - fL) / sX,
      height: (fB - fT) / sY,
      left: fL, top: fT,
    });
    img.setCoords(); c.setActiveObject(img); c.requestRenderAll(); capture(); sync();
  }
  function cancelCropFrame() {
    const c = fabricRef.current; const refs = cropRefs.current; if (!c || !refs) { setCropping(false); return; }
    c.remove(refs.frame); refs.img.selectable = true; refs.img.evented = true;
    c.setActiveObject(refs.img); cropRefs.current = null; setCropping(false); c.requestRenderAll();
  }
  function onReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; const o = activeImage(); e.target.value = '';
    if (!f || !o) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const c = fabricRef.current; if (!c || typeof reader.result !== 'string') return;
      try {
        await (o as any).setSrc(reader.result, { crossOrigin: 'anonymous' });
        resetCrop(o); applyImageEffects(o, readImgFx(o));
        c.requestRenderAll(); capture(); sync();
      } catch { /* noop */ }
    };
    reader.readAsDataURL(f);
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
  // Degradado de relleno con dirección (horizontal/vertical/diagonal/radial),
  // de un solo tono (color base → aclarado), como PowerPoint.
  function applyGradient(dir: 'h' | 'v' | 'd' | 'r' = 'h') {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o || o.type === 'line') return;
    const w = (o.width || 200) * (o.scaleX || 1);
    const h = ((o.height || (o.radius ? o.radius * 2 : 200))) * (o.scaleY || 1);
    const base = typeof o.fill === 'string' ? o.fill : theme().accent;
    const lite = lightenHex(base, 0.55);
    if (dir === 'r') {
      o.set('fill', new Gradient({
        type: 'radial', gradientUnits: 'pixels',
        coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 1.4 },
        colorStops: [{ offset: 0, color: lite }, { offset: 1, color: base }],
      }));
    } else {
      const coords = dir === 'v' ? { x1: 0, y1: 0, x2: 0, y2: h }
        : dir === 'd' ? { x1: 0, y1: 0, x2: w, y2: h }
          : { x1: 0, y1: 0, x2: w, y2: 0 };
      o.set('fill', new Gradient({ type: 'linear', gradientUnits: 'pixels', coords, colorStops: [{ offset: 0, color: base }, { offset: 1, color: lite }] }));
    }
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
    else { const n = parseInt(t, 10); if (!Number.isNaN(n) && n > 0) o.set('link', { type: 'slide', index: n - 1 }); else { toast.error('Indica un número de diapositiva o una URL http(s).'); return; } }
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
  // ── Agrupar / desagrupar (Fabric v7: removeAll restaura coords absolutas) ───
  function groupSel() {
    const c = fabricRef.current; const sel = c?.getActiveObject() as any;
    if (!c || !sel || (sel.type !== 'activeselection' && sel.type !== 'activeSelection')) return;
    const objs = sel.removeAll();
    objs.forEach((o: any) => c.remove(o));
    const g = new Group(objs);
    c.add(g); c.setActiveObject(g); c.requestRenderAll(); capture(); sync();
    setSelType('group'); setSelCount(1);
  }
  function ungroupSel() {
    const c = fabricRef.current; const g = c?.getActiveObject() as any;
    if (!c || !g || g.type !== 'group') return;
    const objs = g.removeAll();
    c.remove(g);
    objs.forEach((o: any) => c.add(o));
    const sel = new ActiveSelection(objs, { canvas: c });
    c.setActiveObject(sel); c.requestRenderAll(); capture(); sync();
    setSelType('activeselection'); setSelCount(objs.length);
  }
  function selectAll() {
    const c = fabricRef.current; if (!c) return;
    const objs = c.getObjects().filter((o: any) => o.selectable !== false && o.visible !== false);
    if (!objs.length) return;
    c.discardActiveObject();
    if (objs.length === 1) c.setActiveObject(objs[0]);
    else c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
    c.requestRenderAll();
    setHasSel(true); setSelType(objs.length === 1 ? (objs[0] as any).type || '' : 'activeselection'); setSelCount(objs.length);
  }
  function cycleSelection(dir: number) {
    const c = fabricRef.current; if (!c) return;
    const objs = c.getObjects().filter((o: any) => o.selectable !== false && o.visible !== false);
    if (!objs.length) return;
    const cur = c.getActiveObject();
    const idx = cur ? objs.indexOf(cur as any) : -1;
    const next = objs[((idx + dir) % objs.length + objs.length) % objs.length];
    c.discardActiveObject(); c.setActiveObject(next); c.requestRenderAll();
    setHasSel(true); setSelType((next as any).type || ''); setSelCount(1);
  }
  function setAngle(v: number) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any;
    if (!c || !o) return;
    o.rotate(((v % 360) + 360) % 360); o.setCoords(); setSelAngle(Math.round(o.angle));
    c.requestRenderAll(); capture(); sync();
  }
  function rotateBy(delta: number) {
    const o = fabricRef.current?.getActiveObject() as any;
    if (o) setAngle(Math.round((o.angle ?? 0) + delta));
  }
  // Posición y tamaño precisos del objeto seleccionado.
  function setGeom(patch: { x?: number; y?: number; w?: number; h?: number; angle?: number }) {
    const c = fabricRef.current; const o = c?.getActiveObject() as any; if (!c || !o) return;
    if (patch.x !== undefined) o.set('left', patch.x);
    if (patch.y !== undefined) o.set('top', patch.y);
    if (patch.angle !== undefined) { o.rotate((((patch.angle % 360) + 360) % 360)); setSelAngle(Math.round(o.angle)); }
    if (patch.w !== undefined && o.width) o.set('scaleX', Math.max(0.01, patch.w / o.width));
    if (patch.h !== undefined && o.height) o.set('scaleY', Math.max(0.01, patch.h / o.height));
    o.setCoords(); c.requestRenderAll(); capture(); sync();
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
    else if (dir === 'vcenter') o.set('top', (ch - h) / 2);
    else if (dir === 'bottom') o.set('top', ch - h);
    o.setCoords(); c.requestRenderAll(); capture(); sync();
  }
  // Alinear/distribuir: con varios objetos, relativo a la selección; con uno, al lienzo.
  function doAlign(dir: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
    const c = fabricRef.current; const sel = c?.getActiveObject() as any; if (!c || !sel) return;
    const objs: any[] = sel._objects ? [...sel._objects] : [sel];
    if (objs.length < 2) { alignObj(dir); return; }
    c.discardActiveObject();
    const rects = objs.map((o) => o.getBoundingRect());
    const minL = Math.min(...rects.map((r) => r.left)), maxR = Math.max(...rects.map((r) => r.left + r.width));
    const minT = Math.min(...rects.map((r) => r.top)), maxB = Math.max(...rects.map((r) => r.top + r.height));
    objs.forEach((o, k) => {
      const r = rects[k];
      if (dir === 'left') o.left += minL - r.left;
      else if (dir === 'right') o.left += maxR - (r.left + r.width);
      else if (dir === 'hcenter') o.left += (minL + maxR) / 2 - (r.left + r.width / 2);
      else if (dir === 'top') o.top += minT - r.top;
      else if (dir === 'bottom') o.top += maxB - (r.top + r.height);
      else if (dir === 'vcenter') o.top += (minT + maxB) / 2 - (r.top + r.height / 2);
      o.setCoords();
    });
    c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
    c.requestRenderAll(); capture(); sync();
  }
  function distribute(axis: 'h' | 'v') {
    const c = fabricRef.current; const sel = c?.getActiveObject() as any; if (!c || !sel || !sel._objects || sel._objects.length < 3) return;
    const objs: any[] = [...sel._objects];
    c.discardActiveObject();
    const items = objs.map((o) => ({ o, r: o.getBoundingRect() }));
    items.sort((a, b) => (axis === 'h' ? (a.r.left + a.r.width / 2) - (b.r.left + b.r.width / 2) : (a.r.top + a.r.height / 2) - (b.r.top + b.r.height / 2)));
    const c0 = axis === 'h' ? items[0].r.left + items[0].r.width / 2 : items[0].r.top + items[0].r.height / 2;
    const last = items[items.length - 1].r;
    const cN = axis === 'h' ? last.left + last.width / 2 : last.top + last.height / 2;
    const step = (cN - c0) / (items.length - 1);
    items.forEach((it, k) => {
      const target = c0 + k * step;
      if (axis === 'h') it.o.left += target - (it.r.left + it.r.width / 2);
      else it.o.top += target - (it.r.top + it.r.height / 2);
      it.o.setCoords();
    });
    c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
    c.requestRenderAll(); capture(); sync();
  }
  // ── Copiar/pegar formato (brocha de formato) ────────────────────────────────
  const formatRef = useRef<any>(null);
  function copyFormat() {
    const o = fabricRef.current?.getActiveObject() as any; if (!o) return;
    formatRef.current = {
      fill: o.fill, stroke: o.stroke, strokeWidth: o.strokeWidth, opacity: o.opacity,
      shadow: o.shadow ? o.shadow.toObject?.() ?? o.shadow : null, rx: o.rx, ry: o.ry,
      fontFamily: o.fontFamily, fontSize: o.fontSize, fontWeight: o.fontWeight, fontStyle: o.fontStyle,
      underline: o.underline, textAlign: o.textAlign, charSpacing: o.charSpacing, lineHeight: o.lineHeight, paintFirst: o.paintFirst,
    };
  }
  function pasteFormat() {
    const c = fabricRef.current; const o = c?.getActiveObject() as any; const f = formatRef.current;
    if (!c || !o || !f) return;
    const common = ['fill', 'stroke', 'strokeWidth', 'opacity', 'shadow', 'paintFirst'];
    const textProps = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'textAlign', 'charSpacing', 'lineHeight'];
    for (const k of common) if (f[k] !== undefined) o.set(k, k === 'shadow' && f[k] ? new Shadow(f[k]) : f[k]);
    if (isText(o)) for (const k of textProps) if (f[k] !== undefined) o.set(k, f[k]);
    if ((o.type === 'rect') && f.rx !== undefined) o.set({ rx: f.rx, ry: f.ry });
    c.requestRenderAll(); capture(); sync();
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
      if (croppingRef.current) { if (e.key === 'Escape') cancelCropFrame(); else if (e.key === 'Enter') applyCropFrame(); return; }
      if (e.key === 'F5') { e.preventDefault(); capture(); presentStartRef.current = e.shiftKey ? curRef.current : 0; setPresenterMode(false); setPresenting(true); return; }
      const o = c.getActiveObject() as any;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (meta && k === 'v') { e.preventDefault(); pasteObj(); return; }
      if (meta && k === 'h') { e.preventDefault(); capture(); setFindOpen(true); return; }
      if (meta && k === 'a') { e.preventDefault(); selectAll(); return; }
      if (e.key === 'Tab') { e.preventDefault(); cycleSelection(e.shiftKey ? -1 : 1); return; }
      if (!o || o.isEditing) return;
      if (meta && k === 'c') { clipboardRef.current = o; return; }
      if (meta && k === 'd') { e.preventDefault(); dupObj(); return; }
      if (meta && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
      if (meta && k === 'b') { e.preventDefault(); toggleBold(); return; }
      if (meta && k === 'i') { e.preventDefault(); toggleItalic(); return; }
      if (meta && k === 'u') { e.preventDefault(); toggleUnderline(); return; }
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

  function addSlide() { if (masterModeRef.current) return; capture(); slidesRef.current.splice(cur + 1, 0, blank()); notesRef.current.splice(cur + 1, 0, ''); sectionsRef.current.splice(cur + 1, 0, null); transitionsRef.current.splice(cur + 1, 0, transitionsRef.current[cur] ?? 'fade'); transDursRef.current.splice(cur + 1, 0, transDursRef.current[cur] ?? DEFAULT_TRANS_DUR); advanceRef.current.splice(cur + 1, 0, 0); sync(); loadInto(cur + 1); }
  // Reutilizar diapositivas: inserta una copia (de este mazo u otro importado)
  // después de la actual, conservando su formato/notas/transición.
  function openReuse() { if (masterModeRef.current) return; capture(); setReuseOpen(true); }
  function insertReused(item: ReuseItem) {
    if (masterModeRef.current) return;
    capture();
    const at = curRef.current + 1;
    slidesRef.current.splice(at, 0, JSON.parse(JSON.stringify(item.slide)));
    notesRef.current.splice(at, 0, item.note || '');
    sectionsRef.current.splice(at, 0, null);
    transitionsRef.current.splice(at, 0, item.transition || 'fade');
    transDursRef.current.splice(at, 0, item.transDur || DEFAULT_TRANS_DUR);
    advanceRef.current.splice(at, 0, 0);
    sync(); loadInto(at);
  }
  function dupSlide() { if (masterModeRef.current) return; capture(); slidesRef.current.splice(cur + 1, 0, JSON.parse(JSON.stringify(slidesRef.current[cur]))); notesRef.current.splice(cur + 1, 0, notesRef.current[cur] ?? ''); sectionsRef.current.splice(cur + 1, 0, null); transitionsRef.current.splice(cur + 1, 0, transitionsRef.current[cur] ?? 'fade'); transDursRef.current.splice(cur + 1, 0, transDursRef.current[cur] ?? DEFAULT_TRANS_DUR); advanceRef.current.splice(cur + 1, 0, advanceRef.current[cur] ?? 0); sync(); loadInto(cur + 1); }
  function delSlide(i: number) { if (masterModeRef.current || slidesRef.current.length === 1) return; capture(); slidesRef.current.splice(i, 1); notesRef.current.splice(i, 1); sectionsRef.current.splice(i, 1); transitionsRef.current.splice(i, 1); transDursRef.current.splice(i, 1); advanceRef.current.splice(i, 1); sync(); loadInto(Math.max(0, i <= cur ? cur - 1 : cur)); }
  function reorderSlides(from: number, to: number) {
    if (from === to || masterModeRef.current) return;
    capture();
    const [m] = slidesRef.current.splice(from, 1); slidesRef.current.splice(to, 0, m);
    const [mn] = notesRef.current.splice(from, 1); notesRef.current.splice(to, 0, mn);
    const [ms] = sectionsRef.current.splice(from, 1); sectionsRef.current.splice(to, 0, ms);
    const [mt] = transitionsRef.current.splice(from, 1); transitionsRef.current.splice(to, 0, mt);
    const [md] = transDursRef.current.splice(from, 1); transDursRef.current.splice(to, 0, md);
    const [ma] = advanceRef.current.splice(from, 1); advanceRef.current.splice(to, 0, ma);
    sync(); loadInto(to);
  }
  // ── Secciones (marcas paralelas a las diapositivas) ─────────────────────────
  function addSection() {
    const n = sectionsRef.current.filter(Boolean).length + 1;
    const title = window.prompt('Título de la sección', `Sección ${n}`);
    if (title === null) return;
    sectionsRef.current[cur] = title.trim() || `Sección ${n}`;
    sync();
  }
  function renameSection(i: number) {
    const title = window.prompt('Renombrar sección', sectionsRef.current[i] || '');
    if (title === null) return;
    sectionsRef.current[i] = title.trim() || sectionsRef.current[i];
    sync();
  }
  function removeSection(i: number) { sectionsRef.current[i] = null; sync(); }
  // ── Zoom / ajustar a pantalla (zoom de la vista de Fabric) ──────────────────
  function applyZoom(z: number) {
    const zz = Math.max(0.25, Math.min(3, z));
    const c = fabricRef.current;
    if (c) { c.setZoom(zz); c.setDimensions({ width: CW * zz, height: ch * zz }); c.requestRenderAll(); }
    setZoom(zz);
  }
  function fitZoom() {
    const el = stageRef.current; if (!el) { applyZoom(1); return; }
    applyZoom(Math.min((el.clientWidth - 36) / CW, (el.clientHeight - 36) / ch));
  }
  function applySlideSize(r: string) {
    if (masterModeRef.current) return;
    ratioRef.current = r; setRatio(r);
    const nc = slideHeight(r);
    const c = fabricRef.current;
    if (c) { c.setDimensions({ width: CW * zoom, height: nc * zoom }); c.setZoom(zoom); c.requestRenderAll(); }
    // Re-renderiza el patrón a la nueva altura y lo recompone.
    (async () => { await renderMasterImage(); await applyMasterBg(); })();
    sync();
  }
  // ── Botones de acción (navegación por hipervínculo) ─────────────────────────
  function addActionButton(kind: 'first' | 'prev' | 'next' | 'last' | 'slide') {
    const c = fabricRef.current; if (!c) return;
    let link: any = { type: kind };
    let label = 'Acción';
    if (kind === 'first') label = '⏮ Inicio';
    else if (kind === 'prev') label = '◀ Anterior';
    else if (kind === 'next') label = 'Siguiente ▶';
    else if (kind === 'last') label = 'Final ⏭';
    else {
      const v = window.prompt('Ir a la diapositiva número:', '1');
      if (v === null) return; const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 1) { toast.error('Indica un número de diapositiva válido.'); return; }
      link = { type: 'slide', index: n - 1 }; label = `Ir a ${n}`;
    }
    const t = theme();
    const rect = new Rect({ left: 0, top: 0, width: 200, height: 56, rx: 12, ry: 12, fill: t.accent });
    const txt = new Textbox(label, { left: 0, top: 16, width: 200, fontSize: 20, fill: '#ffffff', textAlign: 'center', fontFamily: t.font, fontWeight: 'bold' });
    const g = new Group([rect, txt], {} as any);
    g.set({ left: 380, top: 360 });
    (g as any).link = link;
    c.add(g); c.setActiveObject(g); c.requestRenderAll(); capture(); sync();
  }

  // Lista para el panel de animación (se recalcula en cada render desde el lienzo).
  const animList: AnimItem[] = (() => {
    const c = fabricRef.current; if (!showAnimPanel || !c) return [];
    return c.getObjects()
      .map((o: any, idx: number) => ({ o, idx }))
      .filter((x) => !isConnector(x.o) && !isBgFill(x.o))
      .map(({ o, idx }) => ({ idx, label: objLabel(o), type: typeName(o), anim: (o.anim as string) || 'none', order: o.animOrder ?? 0, dur: o.animDur ?? 500, delay: o.animDelay ?? 0, start: (o.animStart as string) || DEFAULT_ANIM_START, kind: animKind(o.anim as string) }));
  })();
  const layerList: LayerItem[] = (() => {
    const c = fabricRef.current; if (!showLayers || !c) return [];
    return c.getObjects().map((o: any, idx: number) => ({ o, idx })).filter((x) => !isBgFill(x.o)).map(({ o, idx }) => ({ idx, label: objLabel(o), type: typeName(o), visible: o.visible !== false, locked: !!o.locked }));
  })();
  const activeIdx = (() => {
    const c = fabricRef.current; const a = c?.getActiveObject(); if (!c || !a) return -1;
    return c.getObjects().indexOf(a as any);
  })();
  const selGeom = (() => {
    const o = fabricRef.current?.getActiveObject() as any; if (!o) return null;
    return { x: Math.round(o.left || 0), y: Math.round(o.top || 0), w: Math.round(o.getScaledWidth?.() || 0), h: Math.round(o.getScaledHeight?.() || 0), angle: Math.round(o.angle || 0) };
  })();

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
              <RibbonButton icon={Layers} label="Reutilizar diapositivas" hideLabel={false} onClick={openReuse} />
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
              <RibbonMenuButton icon={MoveHorizontal} label="Espaciado entre letras" menuWidth={170} items={[
                { label: 'Más estrecho', onClick: () => changeCharSpacing(-40) },
                { label: 'Normal', onClick: () => textSet((o) => o.set('charSpacing', 0)) },
                { label: 'Más amplio', onClick: () => changeCharSpacing(40) },
              ]} />
              <RibbonColorButton icon={PaintBucket} title="Color de relleno / texto" onChange={setColor} swatchBar={false} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Párrafo">
              <RibbonButton icon={AlignLeft} label="Alinear a la izquierda" onClick={() => setTextAlign('left')} />
              <RibbonButton icon={AlignCenter} label="Centrar texto" onClick={() => setTextAlign('center')} />
              <RibbonButton icon={AlignRight} label="Alinear a la derecha" onClick={() => setTextAlign('right')} />
              <RibbonButton icon={List} label="Viñetas" onClick={toggleBullets} />
              <RibbonButton icon={IndentIncrease} label="Aumentar nivel" onClick={() => indentLevel(1)} />
              <RibbonButton icon={IndentDecrease} label="Disminuir nivel" onClick={() => indentLevel(-1)} />
              <RibbonMenuButton icon={AlignVerticalSpaceAround} label="Interlineado" menuWidth={150} items={[
                { label: 'Sencillo (1,0)', onClick: () => setLineHeight(1) },
                { label: '1,15', onClick: () => setLineHeight(1.15) },
                { label: '1,5', onClick: () => setLineHeight(1.5) },
                { label: 'Doble (2,0)', onClick: () => setLineHeight(2) },
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Edición">
              <RibbonButton icon={Search} label="Buscar y reemplazar" shortcut="Ctrl+H" onClick={() => { capture(); setFindOpen(true); }} />
              <RibbonButton icon={CopyPlus} label="Duplicar elemento" shortcut="Ctrl+D" onClick={dupObj} />
              <RibbonButton icon={Trash2} label="Eliminar elemento" danger onClick={del} />
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="design" label="Diseño">
            <RibbonGroup label="Diseños">
              <RibbonMenuButton icon={LayoutTemplate} label="Diseño" menuWidth={220} items={SLIDE_LAYOUTS.map((l) => ({ label: l.name, onClick: () => applyLayout(l.id) }))} />
              <RibbonButton icon={LayoutGrid} label="Plantillas" hideLabel={false} onClick={() => setShowTemplates(true)} />
              <RibbonMenuButton icon={Stamp} label={masterMode ? 'Patrón ✦' : 'Patrón'} menuWidth={250} items={[
                { label: masterMode ? '✕ Salir del patrón' : '✎ Editar patrón de diapositivas', onClick: () => (masterMode ? exitMasterMode() : enterMasterMode()) },
                ...(hasMaster ? [{ label: '🗑 Vaciar patrón', onClick: clearMaster }] : []),
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Temas">
              <RibbonMenuButton icon={Brush} label="Temas" menuWidth={280}>
                <div className="grid grid-cols-2 gap-1.5">
                  {SLIDE_THEMES.map((t) => (
                    <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyTheme(t.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${themeId === t.id ? 'border-blue-500' : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'}`}>
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.bg, border: '1px solid rgba(0,0,0,.1)' }}>
                        <span className="w-4 h-4 rounded-full" style={{ background: t.accent }} />
                      </span>
                      <span className="text-xs font-medium" style={{ color: undefined }}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </RibbonMenuButton>
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Fondo">
              <RibbonColorButton icon={Palette} title="Fondo de todas las diapositivas" onChange={applyBgAll} swatchBar={false} />
              <RibbonColorButton icon={PaintBucket} title="Fondo de esta diapositiva" onChange={applyBgCurrent} swatchBar={false} />
              <RibbonMenuButton icon={Blend} label="Degradados" menuWidth={272}>
                <BgGallery onApply={applyBgPreset} onRemove={removeBgFill} />
              </RibbonMenuButton>
              <label title="Imagen de fondo (diapositiva actual)" className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 cursor-pointer">
                <ImagePlus className="w-[17px] h-[17px]" strokeWidth={1.75} /><input type="file" accept="image/*" onChange={onBgImageFile} className="hidden" />
              </label>
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Tamaño">
              <RibbonMenuButton icon={Proportions} label={`Tamaño · ${ratio}`} menuWidth={200}
                items={SLIDE_RATIOS.map((r) => ({ label: r.label, onClick: () => applySlideSize(r.value) }))} />
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
              <RibbonMenuButton icon={Shapes} label="Formas" menuWidth={272}>
                <ShapeGallery onPick={addShapeByKind} />
              </RibbonMenuButton>
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Gráfico">
              <RibbonButton icon={BarChart3} label="Gráfico" hideLabel={false} onClick={openChartEditor} />
              <RibbonButton icon={Workflow} label="SmartArt" hideLabel={false} onClick={openSmartEditor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Tablas">
              <RibbonMenuButton icon={Table2} label="Tabla" menuWidth={200} items={[
                { label: 'Tabla 2 × 2', onClick: () => insertTable(2, 2) },
                { label: 'Tabla 3 × 3', onClick: () => insertTable(3, 3) },
                { label: 'Tabla 4 × 3', onClick: () => insertTable(3, 4) },
                { label: 'Tabla 5 × 4', onClick: () => insertTable(4, 5) },
                { label: 'Personalizar…', onClick: openTableEditor },
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Iconos">
              <SlideIconPicker onPick={addIcon} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Vínculos">
              <RibbonButton icon={Link2} label="Hipervínculo" onClick={setObjLink} />
              <RibbonMenuButton icon={MousePointerClick} label="Botón de acción" menuWidth={190} items={[
                { label: '⏮ Ir al inicio', onClick: () => addActionButton('first') },
                { label: '◀ Diapositiva anterior', onClick: () => addActionButton('prev') },
                { label: '▶ Diapositiva siguiente', onClick: () => addActionButton('next') },
                { label: '⏭ Ir al final', onClick: () => addActionButton('last') },
                { label: '# Ir a diapositiva…', onClick: () => addActionButton('slide') },
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Dibujar">
              <RibbonButton icon={Pencil} label="Lápiz (dibujo libre)" active={drawMode} onClick={toggleDraw} />
              <RibbonColorButton icon={Palette} title="Color del lápiz" value={penColor} onChange={(col) => setBrush({ color: col })} swatchBar />
              <RibbonSelect title="Grosor del lápiz" value={String(penWidth)} onChange={(v) => setBrush({ width: Number(v) })} width={88}
                options={[{ label: 'Fino', value: '2' }, { label: 'Medio', value: '4' }, { label: 'Grueso', value: '8' }, { label: 'XL', value: '14' }]} />
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="format" label="Formato">
            <RibbonGroup label="Organizar">
              <RibbonButton icon={ChevronsUp} label="Traer al frente" onClick={front} />
              <RibbonButton icon={ChevronsDown} label="Enviar atrás" onClick={back} />
              <RibbonButton icon={AlignHorizontalJustifyStart} label="Alinear a la izquierda" onClick={() => doAlign('left')} />
              <RibbonButton icon={AlignHorizontalJustifyCenter} label="Centrar horizontal" onClick={() => doAlign('hcenter')} />
              <RibbonButton icon={AlignHorizontalJustifyEnd} label="Alinear a la derecha" onClick={() => doAlign('right')} />
              <RibbonButton icon={AlignVerticalJustifyStart} label="Alinear arriba" onClick={() => doAlign('top')} />
              <RibbonButton icon={AlignVerticalJustifyCenter} label="Centrar vertical" onClick={() => doAlign('vcenter')} />
              <RibbonButton icon={AlignVerticalJustifyEnd} label="Alinear abajo" onClick={() => doAlign('bottom')} />
              <RibbonButton icon={FlipHorizontal} label="Voltear horizontal" onClick={() => flip('x')} />
              <RibbonButton icon={FlipVertical} label="Voltear vertical" onClick={() => flip('y')} />
              <RibbonButton icon={selLocked ? Unlock : Lock} label={selLocked ? 'Desbloquear posición' : 'Bloquear posición'} active={selLocked} onClick={toggleLock} />
              {(selType === 'activeselection' || selType === 'activeSelection') && selCount > 1 && (
                <>
                  <RibbonButton icon={GroupIcon} label="Agrupar" shortcut="Ctrl+G" onClick={groupSel} />
                  <RibbonButton icon={Spline} label="Conectar" onClick={() => connect(false)} />
                  <RibbonButton icon={Waypoints} label="Conectar con flecha" onClick={() => connect(true)} />
                </>
              )}
              {selType === 'group' && (
                <RibbonButton icon={Ungroup} label="Desagrupar" shortcut="Ctrl+Shift+G" onClick={ungroupSel} />
              )}
              {(selType === 'activeselection' || selType === 'activeSelection') && selCount >= 3 && (
                <>
                  <RibbonButton icon={AlignHorizontalSpaceAround} label="Distribuir horizontal" onClick={() => distribute('h')} />
                  <RibbonButton icon={AlignVerticalSpaceAround} label="Distribuir vertical" onClick={() => distribute('v')} />
                </>
              )}
              <RibbonButton icon={Paintbrush} label="Copiar formato" onClick={copyFormat} />
              <RibbonButton icon={Stamp} label="Pegar formato" onClick={pasteFormat} />
              <RibbonButton icon={Eraser} label="Borrar formato" onClick={resetFormat} />
            </RibbonGroup>
            {hasSel && (
              <>
                <RibbonSeparator />
                <RibbonGroup label="Girar">
                  <RibbonButton icon={RotateCw} label="Girar 90° derecha" onClick={() => rotateBy(90)} />
                  <RibbonButton icon={RotateCw} label="Girar 90° izquierda" onClick={() => rotateBy(-90)} />
                  <input type="number" value={selAngle} title="Ángulo (grados)" onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-14 h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-1.5 outline-none border border-transparent focus:border-blue-500/40 text-gray-800 dark:text-gray-100" />
                  <span className="text-[11px] text-gray-400">°</span>
                  {selGeom && (
                    <RibbonMenuButton icon={Move} label="Posición y tamaño" menuWidth={236}>
                      <PositionSizeForm key={activeIdx} initial={selGeom} canSize={selType !== 'line'} onChange={setGeom} />
                    </RibbonMenuButton>
                  )}
                </RibbonGroup>
              </>
            )}
            <RibbonSeparator />
            <RibbonGroup label="Estilo de forma">
              <RibbonMenuButton icon={Sparkles} label="Estilos rápidos" menuWidth={284}>
                <QuickStyleGallery accent={theme().accent} onPick={applyQuickStyle} />
              </RibbonMenuButton>
              <RibbonColorButton icon={PaintBucket} title="Color de relleno" onChange={setColor} swatchBar={false} />
              <RibbonButton icon={Pipette} label="Cuentagotas (color del lienzo)" active={eyedropper} onClick={startEyedropper} />
              <RibbonMenuButton icon={Blend} label="Degradado" menuWidth={190} items={[
                { label: 'Horizontal →', onClick: () => applyGradient('h') },
                { label: 'Vertical ↓', onClick: () => applyGradient('v') },
                { label: 'Diagonal ↘', onClick: () => applyGradient('d') },
                { label: 'Radial ◉', onClick: () => applyGradient('r') },
              ]} />
              <RibbonButton icon={Droplet} label="Sombra" onClick={toggleShadow} />
              <RibbonMenuButton icon={SquareDashed} label="Contorno" menuWidth={190} items={[
                { label: 'Sin contorno', onClick: () => setOutlineWidth(0) },
                { label: 'Contorno fino (1)', onClick: () => setOutlineWidth(1) },
                { label: 'Contorno medio (3)', onClick: () => setOutlineWidth(3) },
                { label: 'Contorno grueso (6)', onClick: () => setOutlineWidth(6) },
                { label: '— Sólido', onClick: () => setOutlineDash('solid') },
                { label: '— Discontinuo', onClick: () => setOutlineDash('dashed') },
                { label: '— Punteado', onClick: () => setOutlineDash('dotted') },
              ]} />
              <RibbonColorButton icon={Square} title="Color de contorno" onChange={setOutlineColor} swatchBar={false} />
              {selType === 'rect' && (
                <RibbonMenuButton icon={Squircle} label="Esquinas" menuWidth={170} items={[
                  { label: 'Rectas', onClick: () => setCorners(0) },
                  { label: 'Suaves', onClick: () => setCorners(10) },
                  { label: 'Redondeadas', onClick: () => setCorners(24) },
                  { label: 'Píldora', onClick: () => setCorners('pill') },
                ]} />
              )}
              {hasSel && (
                <span className="inline-flex items-center gap-1 px-1.5" title="Opacidad del objeto">
                  <input type="range" min={0.1} max={1} step={0.05} value={selOpacity}
                    onChange={(e) => { const v = Number(e.target.value); setSelOpacity(v); setOpacity(v); }}
                    className="w-20 accent-blue-500" />
                </span>
              )}
            </RibbonGroup>
            {(selType === 'textbox' || selType === 'i-text' || selType === 'text') && (
              <>
                <RibbonSeparator />
                <RibbonGroup label="Texto / WordArt">
                  <RibbonMenuButton icon={Sparkles} label="WordArt" menuWidth={200} items={[
                    { label: 'Relleno degradado + sombra', onClick: () => applyWordArt('gradient') },
                    { label: 'Contorno', onClick: () => applyWordArt('outline') },
                    { label: 'Sombra', onClick: () => applyWordArt('shadow') },
                  ]} />
                  <RibbonButton icon={SquareDashed} label="Contorno de texto" onClick={toggleTextOutline} />
                  <RibbonButton icon={List} label="Viñetas" onClick={toggleBullets} />
                  <RibbonButton icon={IndentIncrease} label="Aumentar nivel" onClick={() => indentLevel(1)} />
                  <RibbonButton icon={IndentDecrease} label="Disminuir nivel" onClick={() => indentLevel(-1)} />
                </RibbonGroup>
              </>
            )}
            {selType === 'image' && (
              <>
                <RibbonSeparator />
                <RibbonGroup label="Imagen">
                  <RibbonMenuButton icon={Crop} label="Recortar" menuWidth={210} items={[
                    { label: '✂ Recorte interactivo…', onClick: startCrop },
                    ...CROP_RATIOS.map((r) => ({ label: r.label, onClick: () => cropImage(r.ratio) })),
                    { label: 'Quitar recorte', onClick: uncropImage },
                  ]} />
                  <RibbonMenuButton icon={Wand2} label="Efectos" menuWidth={252}>
                    <ImageEffectsPanel fx={imgFx} onChange={setFx} onReset={resetFx} />
                  </RibbonMenuButton>
                  <RibbonButton icon={SunMedium} label="Más brillo" onClick={() => setFx({ brightness: Math.min(0.6, imgFx.brightness + 0.1) })} />
                  <RibbonButton icon={Contrast} label="Más contraste" onClick={() => setFx({ contrast: Math.min(0.6, imgFx.contrast + 0.1) })} />
                  <label title="Reemplazar imagen" className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 cursor-pointer">
                    <Replace className="w-[17px] h-[17px]" strokeWidth={1.75} /><input type="file" accept="image/*" onChange={onReplaceFile} className="hidden" />
                  </label>
                  <RibbonButton icon={RefreshCw} label="Restablecer imagen" onClick={() => { resetFx(); uncropImage(); }} />
                </RibbonGroup>
              </>
            )}
            <RibbonSeparator />
            <RibbonGroup label="Animación">
              {hasSel ? (
                <>
                  <RibbonSelect title="Animación del objeto (entrada / énfasis / salida)" value={selAnim} onChange={setObjAnim} width={170}
                    options={OBJ_ANIM_OPTIONS} />
                  {selAnim !== 'none' && (
                    <RibbonSelect title="Inicio de la animación" value={selAnimStart} onChange={setObjAnimStart} width={140}
                      options={OBJ_ANIM_START} />
                  )}
                  <span className="text-[11px] text-gray-500 px-1" title="Orden de aparición">Orden</span>
                  <input type="number" min={0} value={selAnimOrder} onChange={(e) => setObjAnimOrder(Number(e.target.value))} title="Orden de aparición"
                    className="w-12 h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-1.5 outline-none border border-transparent focus:border-blue-500/40 text-gray-800 dark:text-gray-100" />
                  <RibbonSelect title="Duración" value={String(selAnimDur)} onChange={(v) => setObjAnimDur(Number(v))} width={96}
                    options={[{ label: 'Rápida', value: '300' }, { label: 'Normal', value: '500' }, { label: 'Lenta', value: '900' }]} />
                  <span className="text-[11px] text-gray-500 px-1" title="Retraso en milisegundos">Retraso</span>
                  <input type="number" min={0} step={100} value={selAnimDelay} onChange={(e) => setObjAnimDelay(Number(e.target.value))} title="Retraso (ms)"
                    className="w-14 h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-1.5 outline-none border border-transparent focus:border-blue-500/40 text-gray-800 dark:text-gray-100" />
                </>
              ) : <span className="text-[11px] text-gray-400 px-2">Selecciona un objeto</span>}
              <RibbonButton icon={ListTree} label="Panel de animación" active={showAnimPanel} onClick={() => { setShowAnimPanel((v) => !v); setShowLayers(false); }} />
            </RibbonGroup>
          </RibbonTab>
        )}

        {!readOnly && (
          <RibbonTab id="transitions" label="Transiciones">
            <RibbonGroup label="Transición de esta diapositiva">
              <RibbonSelect title="Transición de la diapositiva actual" value={transition} onChange={setTrans} width={150}
                options={SLIDE_TRANSITIONS} />
              <span className="text-[11px] text-gray-500 px-1" title="Duración de la transición">Duración</span>
              <RibbonSelect title="Duración de la transición" value={String(transDur)} onChange={(v) => setTransDuration(Number(v))} width={110}
                options={TRANS_DURATIONS} />
              <RibbonButton icon={Copy} label="Aplicar a todas" hideLabel={false} onClick={() => applyTransAll(transition)} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Avanzar diapositiva">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 cursor-pointer" title="Avanzar automáticamente esta diapositiva">
                <input type="checkbox" checked={advanceAfter > 0} onChange={(e) => setSlideAdvance(e.target.checked ? 5 : 0)} className="accent-blue-500" />
                <Timer className="w-3.5 h-3.5" /> Tras
              </label>
              <input type="number" min={0} step={1} value={advanceAfter} onChange={(e) => setSlideAdvance(Number(e.target.value))} title="Segundos (0 = sólo al hacer clic)"
                className="w-14 h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-1.5 outline-none border border-transparent focus:border-blue-500/40 text-gray-800 dark:text-gray-100" />
              <span className="text-[11px] text-gray-500">s</span>
              <RibbonButton icon={Repeat} label="Repetir en bucle" active={loop} onClick={toggleLoop} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Fondo">
              <RibbonColorButton icon={Palette} title="Fondo de todas las diapositivas" onChange={applyBgAll} swatchBar={false} />
            </RibbonGroup>
          </RibbonTab>
        )}

        <RibbonTab id="view" label="Vista">
          <RibbonGroup label="Mostrar">
            <RibbonButton icon={Grid3x3} label="Cuadrícula" active={showGrid} onClick={() => setShowGrid((g) => !g)} />
            {!readOnly && <RibbonButton icon={Layers} label="Panel de selección" active={showLayers} onClick={() => { setShowLayers((v) => !v); setShowAnimPanel(false); }} />}
          </RibbonGroup>
          <RibbonSeparator />
          <RibbonGroup label="Zoom">
            <RibbonButton icon={ZoomOut} label="Alejar" onClick={() => applyZoom(zoom - 0.1)} />
            <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
            <RibbonButton icon={ZoomIn} label="Acercar" onClick={() => applyZoom(zoom + 0.1)} />
            <RibbonButton icon={Maximize} label="Ajustar a pantalla" onClick={fitZoom} />
            <RibbonButton icon={Scan} label="100%" onClick={() => applyZoom(1)} />
          </RibbonGroup>
          {!readOnly && (
            <>
              <RibbonSeparator />
              <RibbonGroup label="Diapositiva">
                <RibbonButton icon={Hash} label="Números de diapositiva" active={showNumbers} onClick={toggleNumbers} />
                <RibbonButton icon={Type} label="Pie de diapositiva" onClick={editFooter} />
              </RibbonGroup>
            </>
          )}
          <RibbonSeparator />
          <RibbonGroup label="Presentación">
            <RibbonButton icon={Play} label="Presentar (F5)" hideLabel={false} onClick={() => { capture(); presentStartRef.current = 0; setPresenterMode(false); setPresenting(true); }} />
            <RibbonButton icon={PlayCircle} label="Desde aquí (Shift+F5)" hideLabel={false} onClick={() => { capture(); presentStartRef.current = cur; setPresenterMode(false); setPresenting(true); }} />
            <RibbonButton icon={MonitorPlay} label="Presentador" hideLabel={false} onClick={() => { capture(); presentStartRef.current = cur; setPresenterMode(true); setPresenting(true); }} />
            <RibbonButton icon={LayoutGrid} label="Clasificador" hideLabel={false} onClick={() => { capture(); setSorter(true); }} />
            {!readOnly && <RibbonButton icon={ListTree} label="Esquema" hideLabel={false} onClick={() => { capture(); setOutlineOpen(true); }} />}
          </RibbonGroup>
        </RibbonTab>
      </OfficeRibbon>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className={`w-44 flex-shrink-0 overflow-y-auto space-y-2 pr-1 transition-opacity ${masterMode ? 'opacity-40 pointer-events-none' : ''}`}>
          {slides.map((s, i) => (
            <React.Fragment key={i}>
              {sections[i] != null && (
                <div className="flex items-center gap-1 pt-1 group/sec">
                  <button onClick={() => !readOnly && renameSection(i)} title="Renombrar sección" className="flex-1 min-w-0 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate hover:text-gray-800 dark:hover:text-gray-200">▸ {sections[i]}</button>
                  {!readOnly && <button onClick={() => removeSection(i)} title="Quitar sección" className="p-0.5 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover/sec:opacity-100"><X className="w-3 h-3" /></button>}
                </div>
              )}
              <div className="relative group">
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
            </React.Fragment>
          ))}
          {!readOnly && (
          <>
          <div className="flex gap-2">
            <button onClick={addSlide} title="Nueva" className="flex-1 aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Plus className="w-5 h-5" /></button>
            <button onClick={dupSlide} title="Duplicar" className="flex-1 aspect-video rounded-lg border-2 border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"><Copy className="w-5 h-5" /></button>
          </div>
          <button onClick={addSection} title="Agregar sección en la diapositiva actual" className="w-full text-[11px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-dashed border-gray-300 dark:border-white/20 rounded-lg py-1 flex items-center justify-center gap-1"><FolderPlus className="w-3.5 h-3.5" /> Sección</button>
          </>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          {masterMode && (
            <div className="flex-shrink-0 flex items-center gap-3 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-sm">
              <Stamp className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="font-semibold text-amber-700 dark:text-amber-300">Editando el patrón de diapositivas</span>
              <span className="text-amber-700/70 dark:text-amber-300/70 hidden sm:inline">Lo que agregues aquí (logo, barras, marcos) aparece detrás de todas las diapositivas.</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={clearMaster} className="text-xs px-2.5 py-1 rounded-lg bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-amber-800 dark:text-amber-200">Vaciar patrón</button>
                <button onClick={exitMasterMode} className="text-xs px-3 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-medium">Salir del patrón</button>
              </div>
            </div>
          )}
          <div ref={stageRef} className="flex-1 min-h-0 bg-gray-100 dark:bg-[#0b0b0b] rounded-2xl flex items-center justify-center overflow-auto p-4">
            <div className="shadow-2xl relative flex-shrink-0" style={{ width: CW * zoom, height: ch * zoom }}>
              <canvas ref={elRef} />
              {showGrid && (
                <div className="pointer-events-none absolute inset-0" aria-hidden style={{
                  backgroundImage: 'linear-gradient(to right, rgba(0,0,0,.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.09) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }} />
              )}
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
        {showAnimPanel && !readOnly && (
          <SlideAnimationPanel items={animList} activeIdx={activeIdx} onChange={setAnimByIndex} onSelect={selectByIndex} onPreview={() => { capture(); presentStartRef.current = curRef.current; setPreview(true); }} onClose={() => setShowAnimPanel(false)} />
        )}
        {showLayers && !readOnly && (
          <SlideLayersPanel items={layerList} activeIdx={activeIdx} onSelect={selectByIndex} onToggleVisible={toggleVisibleIdx} onToggleLock={toggleLockIdx} onForward={forwardIdx} onBackward={backwardIdx} onFront={frontIdx} onBack={backIdx} onReorder={reorderObject} onClose={() => setShowLayers(false)} />
        )}
      </div>

      {cropping && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 shadow-2xl">
          <span className="text-xs text-gray-500 px-1 hidden sm:inline">Arrastra el marco para recortar</span>
          <button onClick={applyCropFrame} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600"><Check className="w-4 h-4" /> Aplicar</button>
          <button onClick={cancelCropFrame} className="text-sm px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar (Esc)</button>
        </div>
      )}

      {presenting && <Present slides={slides} notes={notesRef.current} transition={transition} transitions={transitionsRef.current} transDurs={transDursRef.current} advanceAfters={advanceRef.current} loop={loop} master={masterImgRef.current} footer={footerRef.current} showNumbers={showNumbers} presenter={presenterMode} ratio={ratio} startAt={presentStartRef.current} onClose={() => { setPresenting(false); setPresenterMode(false); }} />}
      {preview && <Present slides={slides} transitions={transitionsRef.current} transDurs={transDursRef.current} master={masterImgRef.current} ratio={ratio} previewOne startAt={presentStartRef.current} onClose={() => setPreview(false)} />}
      <AnimatePresence>
        {showTemplates && <TemplateGallery type="slides" onPick={applyTemplate} onClose={() => setShowTemplates(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {reuseOpen && !readOnly && (
          <SlideReusePanel
            ratio={ratio}
            current={slidesRef.current.map((s, i) => ({ slide: s, note: notesRef.current[i] || '', transition: transitionsRef.current[i] || 'fade', transDur: transDursRef.current[i] || DEFAULT_TRANS_DUR }))}
            onInsert={(item) => { insertReused(item); setReuseOpen(false); }}
            onClose={() => setReuseOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chartEditor && <SlideChartEditor spec={chartEditor.spec} onApply={applyChart} onClose={() => { chartTargetRef.current = null; setChartEditor(null); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {smartEditor && <SlideSmartArtEditor spec={smartEditor.spec} onApply={applySmart} onClose={() => { smartTargetRef.current = null; setSmartEditor(null); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {tableEditor && <SlideTableEditor spec={tableEditor.spec} onApply={applyTable} onClose={() => { tableTargetRef.current = null; setTableEditor(null); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {findOpen && !readOnly && <SlideFindReplace onClose={() => setFindOpen(false)} onCount={countMatches} onNext={findNext} onReplaceAll={replaceAllText} />}
      </AnimatePresence>
      <AnimatePresence>
        {outlineOpen && !readOnly && <SlideOutline slides={slides} current={cur} onTitle={setSlideTitle} onGoto={(i) => { setOutlineOpen(false); goto(i); }} onClose={() => setOutlineOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {sorter && (
          <SlideSorter
            slides={slides}
            current={cur}
            ratio={ratio}
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

// Variantes de transición de diapositiva. Las que llevan dirección (deslizar/
// empujar/cubrir) son funciones de `custom` = dirección de avance (1 adelante,
// -1 atrás), para que al retroceder el movimiento se invierta como en PowerPoint.
const TRANSITIONS: Record<string, any> = {
  none: { initial: {}, animate: {}, exit: {} },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  fadeBlack: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slide: {
    initial: (d: number) => ({ x: d < 0 ? '-100%' : '100%', opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d < 0 ? '100%' : '-100%', opacity: 0 }),
  },
  slideUp: {
    initial: (d: number) => ({ y: d < 0 ? '-100%' : '100%', opacity: 0 }),
    animate: { y: 0, opacity: 1 },
    exit: (d: number) => ({ y: d < 0 ? '100%' : '-100%', opacity: 0 }),
  },
  push: {
    initial: (d: number) => ({ x: d < 0 ? '-60%' : '60%', opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d < 0 ? '60%' : '-60%', opacity: 0 }),
  },
  wipe: { initial: { clipPath: 'inset(0 0 0 100%)' }, animate: { clipPath: 'inset(0 0 0 0%)' }, exit: { opacity: 0 } },
  cover: {
    initial: (d: number) => ({ y: d < 0 ? '-100%' : '100%' }),
    animate: { y: 0 },
    exit: { opacity: 1 },
  },
  zoom: { initial: { scale: 0.85, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.1, opacity: 0 } },
  reveal: { initial: { scale: 1.15, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.92, opacity: 0 } },
  flip: { initial: { rotateY: 90, opacity: 0 }, animate: { rotateY: 0, opacity: 1 }, exit: { rotateY: -90, opacity: 0 } },
  split: { initial: { clipPath: 'inset(0 50% 0 50%)', opacity: 0.4 }, animate: { clipPath: 'inset(0 0% 0 0%)', opacity: 1 }, exit: { clipPath: 'inset(0 50% 0 50%)', opacity: 0 } },
  cube: {
    initial: (d: number) => ({ rotateY: d < 0 ? -90 : 90, opacity: 0 }),
    animate: { rotateY: 0, opacity: 1 },
    exit: (d: number) => ({ rotateY: d < 0 ? 90 : -90, opacity: 0 }),
  },
  morph: { initial: { opacity: 0, scale: 1.05 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 } },
};
// Transiciones que invierten su sentido al retroceder (necesitan `custom`=dir).
const DIRECTIONAL = new Set(['slide', 'slideUp', 'push', 'cover', 'cube']);
const OBJ_ANIM: Record<string, any> = {
  none: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  // Entrada (estado inicial oculto → visible).
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  fly: { initial: { opacity: 0, y: '8%' }, animate: { opacity: 1, y: 0 } },
  flyDown: { initial: { opacity: 0, y: '-8%' }, animate: { opacity: 1, y: 0 } },
  flyLeft: { initial: { opacity: 0, x: '-8%' }, animate: { opacity: 1, x: 0 } },
  flyRight: { initial: { opacity: 0, x: '8%' }, animate: { opacity: 1, x: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
  rotate: { initial: { opacity: 0, rotate: -12, scale: 0.9 }, animate: { opacity: 1, rotate: 0, scale: 1 } },
  bounce: { initial: { opacity: 0, y: '-14%' }, animate: { opacity: 1, y: ['-14%', '5%', '-2%', '0%'] } },
  wipe: { initial: { opacity: 1, clipPath: 'inset(0 100% 0 0)' }, animate: { opacity: 1, clipPath: 'inset(0 0% 0 0)' } },
  swivel: { initial: { opacity: 0, rotateY: 90 }, animate: { opacity: 1, rotateY: 0 } },
  flyTL: { initial: { opacity: 0, x: '-10%', y: '-10%' }, animate: { opacity: 1, x: 0, y: 0 } },
  flyBR: { initial: { opacity: 0, x: '10%', y: '10%' }, animate: { opacity: 1, x: 0, y: 0 } },
  // Énfasis (estado inicial visible; al dispararse reproduce un keyframe que
  // regresa al estado base).
  pulse: { initial: { opacity: 1, scale: 1 }, animate: { scale: [1, 1.12, 1] } },
  spin: { initial: { opacity: 1, rotate: 0 }, animate: { rotate: [0, 360] } },
  grow: { initial: { opacity: 1, scale: 1 }, animate: { scale: [1, 1.3, 1] } },
  flash: { initial: { opacity: 1 }, animate: { opacity: [1, 0.15, 1, 0.15, 1] } },
  teeter: { initial: { opacity: 1, rotate: 0 }, animate: { rotate: [0, -6, 6, -4, 4, 0] } },
  blink: { initial: { opacity: 1 }, animate: { opacity: [1, 0, 1, 0, 1] } },
  // Salida (estado inicial visible → oculto).
  fadeOut: { initial: { opacity: 1 }, animate: { opacity: 0 } },
  flyOut: { initial: { opacity: 1, y: 0 }, animate: { opacity: 0, y: '10%' } },
  zoomOut: { initial: { opacity: 1, scale: 1 }, animate: { opacity: 0, scale: 0.6 } },
  wipeOut: { initial: { opacity: 1, clipPath: 'inset(0 0% 0 0)' }, animate: { opacity: 1, clipPath: 'inset(0 0 0 100%)' } },
  spinOut: { initial: { opacity: 1, rotate: 0, scale: 1 }, animate: { opacity: 0, rotate: 180, scale: 0.5 } },
};

/** Secuencia de animaciones de una diapositiva (modelo de pasos tipo PowerPoint).
 *  `step` 0 = se reproduce al entrar; cada «al hacer clic» abre un paso nuevo.
 *  `start` = retraso (s) relativo al inicio de su paso (with/after previous). */
function planAnim(layers: Layer[]): { plan: Map<number, { step: number; start: number }>; maxStep: number } {
  const animated = layers.map((l, idx) => ({ l, idx }))
    .filter((x) => x.l.anim && x.l.anim !== 'none')
    .sort((a, b) => a.l.order - b.l.order || a.idx - b.idx);
  const plan = new Map<number, { step: number; start: number }>();
  let step = 0; let lastStart = 0; let lastDur = 0;
  for (const { l, idx } of animated) {
    const mode = l.start || 'afterPrev';
    let start: number;
    if (mode === 'onClick') { step += 1; start = 0; lastStart = 0; lastDur = 0; }
    else if (mode === 'withPrev') { start = lastStart; }
    else { start = lastStart + lastDur; }
    start += (typeof l.delay === 'number' ? l.delay : 0) / 1000;
    plan.set(idx, { step, start });
    lastStart = start; lastDur = (l.dur || 500) / 1000;
  }
  return { plan, maxStep: step };
}

interface Layer { src: string; anim: string; order: number; dur: number; delay?: number; start?: string }
interface Deck { bg: string; layers: Layer[] }

/** Capa estática de una diapositiva (sin animación) para miniaturas / presentador. */
function StaticDeck({ deck, master }: { deck?: Deck; master?: string }) {
  if (!deck) return <div className="w-full h-full bg-white" />;
  return (
    <div className="absolute inset-0" style={{ background: deck.bg }}>
      {master && <img src={master} alt="" className="absolute inset-0 w-full h-full object-contain" />}
      {deck.layers.map((L, j) => <img key={j} src={L.src} alt="" className="absolute inset-0 w-full h-full object-contain" />)}
    </div>
  );
}

/** Capa ANIMADA de una diapositiva: reproduce las animaciones de objeto según el
 *  paso revelado (`revealed`). Compartida por el escenario del público y la vista
 *  de presentador (para que las construcciones se vean también ahí). */
function AnimatedDeck({ deck, master, plan, revealed }: { deck?: Deck; master?: string; plan: Map<number, { step: number; start: number }>; revealed: number }) {
  if (!deck) return <div className="absolute inset-0 bg-white" />;
  return (
    <div className="absolute inset-0" style={{ background: deck.bg }}>
      {master && <img src={master} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
      {deck.layers.map((L, j) => {
        const p = plan.get(j);
        const animated = !!(L.anim && L.anim !== 'none');
        const shown = !animated || !p || revealed >= p.step;
        return (
          <motion.img key={j} src={L.src} alt="" className="absolute inset-0 w-full h-full object-contain"
            variants={OBJ_ANIM[L.anim] ?? OBJ_ANIM.none} initial="initial" animate={shown ? 'animate' : 'initial'}
            transition={{ duration: (L.dur || 500) / 1000, ease: 'easeOut', delay: shown && p ? p.start : 0 }} />
        );
      })}
    </div>
  );
}

function Present({
  slides, notes, transition, transitions, transDurs, advanceAfters, loop, master, footer, showNumbers, presenter, previewOne, ratio, startAt, onClose,
}: {
  slides: any[]; notes?: string[]; transition?: string; transitions?: string[]; transDurs?: number[]; advanceAfters?: number[]; loop?: boolean; master?: string; footer?: string; showNumbers?: boolean; presenter?: boolean; previewOne?: boolean; ratio?: string; startAt?: number; onClose: () => void;
}) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [i, setI] = useState(Math.max(0, Math.min((slides?.length ?? 1) - 1, startAt ?? 0)));
  // Dirección de avance (1 = adelante, -1 = atrás) para transiciones direccionales.
  const [dir, setDir] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const variant = TRANSITIONS[transitions?.[i] || transition || 'fade'] ?? TRANSITIONS.fade;
  const transSec = Math.max(0.05, (transDurs?.[i] ?? 500) / 1000);
  const ch = slideHeight(ratio);
  const aspect = ratio === '4:3' ? '4 / 3' : '16 / 9';
  const stageW = ratio === '4:3' ? 'min(100vw, 133.33vh)' : 'min(100vw, 177.78vh)';
  const vbH = ratio === '4:3' ? 75 : 56.25; // alto del viewBox del SVG (ancho 100)
  // Herramientas de presentación pro: puntero láser, lápiz/tinta, pantalla en
  // negro y navegador de miniaturas.
  const [tool, setTool] = useState<'none' | 'laser' | 'pen'>('none');
  const [blacked, setBlacked] = useState(false);
  const [gridNav, setGridNav] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState<Record<number, number[][]>>({});
  // Paso de animación revelado (construcción por clic, tipo PowerPoint). Se
  // deriva de { i, step } para que al cambiar de diapositiva valga 0 de inmediato
  // (sin un render intermedio que muestre el paso de la diapositiva anterior).
  const [reveal, setReveal] = useState<{ i: number; step: number }>({ i: -1, step: 0 });
  const revealed = reveal.i === i ? reveal.step : 0;
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notesScale, setNotesScale] = useState(1);
  const revealedRef = useRef(0);
  const maxStepRef = useRef(0);
  const loopRef = useRef(loop);
  const drawRef = useRef<number[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const iRef = useRef(0);
  const gridRef = useRef(false);
  const previewOneRef = useRef(!!previewOne);
  useEffect(() => { previewOneRef.current = !!previewOne; }, [previewOne]);
  useEffect(() => { iRef.current = i; setLaser(null); }, [i]);
  useEffect(() => { revealedRef.current = revealed; }, [revealed]);
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { gridRef.current = gridNav; }, [gridNav]);
  const slidePt = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect(); if (!r || !r.width) return [0, 0] as const;
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as const;
  };
  const clearInk = () => setInk((p) => ({ ...p, [i]: [] }));

  useEffect(() => {
    let active = true;
    (async () => {
      const out: Deck[] = [];
      for (const json of slides) {
        const layers: Layer[] = [];
        const objs = json?.objects ?? [];
        for (let j = 0; j < objs.length; j++) {
          const o = objs[j];
          try {
            const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: ch });
            await sc.loadFromJSON({ version: json.version, objects: [o] });
            sc.renderAll();
            layers.push({ src: sc.toDataURL({ format: 'png', multiplier: 1 } as any), anim: (o.anim as string) || 'none', order: o.animOrder ?? j, dur: o.animDur ?? 500, delay: typeof o.animDelay === 'number' ? o.animDelay : undefined, start: (o.animStart as string) || 'afterPrev' });
            sc.dispose();
          } catch { /* skip object */ }
        }
        out.push({ bg: (json?.background as string) || '#ffffff', layers });
      }
      if (active) setDecks(out);
    })();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setBlacked(false);
        if (revealedRef.current < maxStepRef.current) setReveal({ i: iRef.current, step: revealedRef.current + 1 });
        else if (previewOneRef.current) setReveal({ i: iRef.current, step: 0 }); // reinicia la vista previa
        else { setDir(1); setI((v) => (v < slides.length - 1 ? v + 1 : (loopRef.current ? 0 : v))); }
      }
      if (e.key === 'ArrowLeft') {
        setBlacked(false);
        if (revealedRef.current > 0) setReveal({ i: iRef.current, step: Math.max(0, revealedRef.current - 1) });
        else if (!previewOneRef.current) { setDir(-1); setI((v) => Math.max(0, v - 1)); }
      }
      if (k === 'n') setShowNotes((v) => !v);
      if (k === 'b') setBlacked((v) => !v);
      if (k === 'l') setTool((t) => (t === 'laser' ? 'none' : 'laser'));
      if (k === 'p') setTool((t) => (t === 'pen' ? 'none' : 'pen'));
      if (k === 'e') setInk((p) => ({ ...p, [iRef.current]: [] }));
      if (k === 'g') setGridNav((v) => !v);
      if (k === 'k') setPaused((v) => !v);
      if (e.key === 'Escape') { if (gridRef.current) setGridNav(false); else onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { active = false; window.removeEventListener('keydown', onKey); };
  }, [slides, onClose]);

  // Temporizador + reloj de hora del día (vista de presentador).
  useEffect(() => {
    if (!presenter) return;
    const t = setInterval(() => { setElapsed((e) => e + 1); setNow(Date.now()); }, 1000);
    return () => clearInterval(t);
  }, [presenter]);
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const clock = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const note = notes?.[i]?.trim();
  const hasNotes = (notes ?? []).some((n) => n?.trim());
  const hasAuto = (advanceAfters ?? []).some((s) => s > 0);
  const deck = decks[i];

  // Secuencia de pasos de animación de la diapositiva actual.
  const { plan, maxStep } = planAnim(deck?.layers ?? []);
  useEffect(() => { maxStepRef.current = maxStep; }, [maxStep]);
  const nextSlide = () => { setDir(1); setI((v) => (v < slides.length - 1 ? v + 1 : (loop ? 0 : v))); };
  const prevSlide = () => { setDir(-1); setI((v) => Math.max(0, v - 1)); };
  const advance = () => { setBlacked(false); if (revealed < maxStep) setReveal({ i, step: revealed + 1 }); else if (previewOne) setReveal({ i, step: 0 }); else nextSlide(); };

  // Vista previa de animación: reproduce sola las construcciones de la
  // diapositiva (un paso cada ~0,85 s) y se detiene al terminar (replay manual).
  useEffect(() => {
    if (!previewOne || revealed >= maxStep) return;
    const t = setTimeout(() => setReveal({ i, step: revealed + 1 }), 850);
    return () => clearTimeout(t);
  }, [previewOne, revealed, maxStep, i]);

  // Avance automático (cronometraje de transición / modo kiosco). Cada disparo
  // revela el siguiente paso de animación (si lo hay) y, si ya no quedan, pasa a
  // la siguiente diapositiva; se rearma con cada cambio para no atascarse en
  // diapositivas con construcciones «al hacer clic». Respeta el bucle.
  useEffect(() => {
    if (presenter || paused || blacked || gridNav) return;
    const sec = advanceAfters?.[i] || 0;
    if (sec <= 0) return;
    const t = setTimeout(() => {
      setBlacked(false);
      if (revealed < maxStep) setReveal({ i, step: revealed + 1 });
      else setI((v) => (v < slides.length - 1 ? v + 1 : (loop ? 0 : v)));
    }, sec * 1000);
    return () => clearTimeout(t);
  }, [i, revealed, maxStep, paused, blacked, gridNav, presenter, advanceAfters, loop, slides.length]);

  const curTrans = transitions?.[i] || transition || 'fade';
  const stage = (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden" style={{ perspective: DIRECTIONAL.has(curTrans) || curTrans === 'flip' ? 1600 : undefined }}>
      {!deck ? <div className="text-white/60">Generando…</div> : (
        <>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={i} custom={dir} variants={variant} initial="initial" animate="animate" exit="exit" transition={{ duration: transSec, ease: 'easeInOut' }}
            className="absolute" style={{ width: stageW, aspectRatio: aspect }}>
            <AnimatedDeck deck={deck} master={master} plan={plan} revealed={revealed} />
            {(slides[i]?.objects ?? []).map((o: any, j: number) => {
              if (!o?.link) return null;
              const w = (o.radius ? o.radius * 2 : (o.width ?? 0)) * (o.scaleX ?? 1);
              const h = (o.radius ? o.radius * 2 : (o.height ?? 0)) * (o.scaleY ?? 1);
              const go = () => {
                const L = o.link; setBlacked(false);
                if (L.type === 'slide') setI(Math.max(0, Math.min(slides.length - 1, L.index)));
                else if (L.type === 'first') setI(0);
                else if (L.type === 'last') setI(slides.length - 1);
                else if (L.type === 'prev') setI(Math.max(0, i - 1));
                else if (L.type === 'next') setI(Math.min(slides.length - 1, i + 1));
                else if (L.href) window.open(L.href, '_blank', 'noopener');
              };
              return <button key={`lnk${j}`} onClick={go} title="Ir al hipervínculo"
                style={{ position: 'absolute', left: `${((o.left ?? 0) / CW) * 100}%`, top: `${((o.top ?? 0) / ch) * 100}%`, width: `${(w / CW) * 100}%`, height: `${(h / ch) * 100}%` }}
                className="cursor-pointer hover:ring-2 ring-blue-400/60 rounded-sm" />;
            })}
            {(showNumbers || footer) && (
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-between px-6 text-[1.1vmin] text-black/50 z-10">
                <span>{footer}</span>{showNumbers && <span>{i + 1} / {slides.length}</span>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {/* Fundido a negro: cubre el cruce con un destello negro (tipo PowerPoint). */}
        {curTrans === 'fadeBlack' && (
          <motion.div key={`fb${i}`} className="absolute pointer-events-none bg-black z-[5]" style={{ width: stageW, aspectRatio: aspect }}
            initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: transSec, ease: 'easeInOut' }} />
        )}
        </>
      )}
    </div>
  );

  // ── Vista de presentador: diapositiva actual + siguiente + notas + temporizador.
  if (presenter) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0a0a0a] text-white flex flex-col">
        <div className="flex items-center gap-4 px-6 h-14 border-b border-white/10 flex-shrink-0">
          <span className="text-sm font-semibold">Vista de presentador</span>
          <span className="ml-2 font-mono text-2xl tabular-nums" title="Tiempo transcurrido">{mmss}</span>
          <button onClick={() => setElapsed(0)} title="Reiniciar el temporizador" className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20">Reiniciar</button>
          <span className="font-mono text-base text-white/70 tabular-nums" title="Hora actual">{clock}</span>
          <span className="ml-auto text-sm text-white/60">Diapositiva {i + 1} de {slides.length}</span>
          <button onClick={onClose} title="Cerrar (Esc)" className="p-2 rounded-full bg-white/15 hover:bg-white/30"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 min-h-0 flex gap-4 p-4">
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-white" style={{ aspectRatio: aspect }}>
              <AnimatedDeck deck={deck} master={master} plan={plan} revealed={revealed} />
              {maxStep > 0 && (
                <span className="absolute top-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white" title="Paso de construcción">Paso {revealed}/{maxStep}</span>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-3">
              <button onClick={() => { if (revealed > 0) setReveal({ i, step: revealed - 1 }); else prevSlide(); }} disabled={i === 0 && revealed === 0} className="w-11 h-11 rounded-full bg-white/15 text-2xl hover:bg-white/30 disabled:opacity-20" title="Anterior (←)">‹</button>
              <button onClick={advance} disabled={i === slides.length - 1 && revealed >= maxStep && !loop} className="w-11 h-11 rounded-full bg-white/15 text-2xl hover:bg-white/30 disabled:opacity-20" title="Siguiente (→)">›</button>
            </div>
          </div>
          <div className="w-80 flex-shrink-0 flex flex-col gap-3">
            <div>
              <p className="text-xs text-white/50 mb-1">{revealed < maxStep ? 'Siguiente · animación' : 'Siguiente · diapositiva'}</p>
              {revealed < maxStep ? (
                <div className="relative rounded-lg overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center text-white/70 text-sm gap-2" style={{ aspectRatio: aspect }}>
                  <PlayCircle className="w-5 h-5" /> Quedan {maxStep - revealed} animación(es)
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden bg-white border border-white/10" style={{ aspectRatio: aspect }}>
                  {i < slides.length - 1 ? <StaticDeck deck={decks[i + 1]} master={master} /> : <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Fin</div>}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 rounded-lg bg-white/5 border border-white/10 p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/50">Notas</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setNotesScale((s) => Math.max(0.8, +(s - 0.1).toFixed(2)))} title="Reducir tamaño de notas" className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-xs leading-none">A−</button>
                  <button onClick={() => setNotesScale((s) => Math.min(2.2, +(s + 0.1).toFixed(2)))} title="Aumentar tamaño de notas" className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-sm leading-none">A+</button>
                </div>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap text-white/90" style={{ fontSize: `${notesScale * 0.875}rem` }}>{note || <span className="text-white/30">Sin notas.</span>}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inkColor = '#ef4444';
  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) advance(); }}>
      {previewOne && (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-500/90 text-white flex items-center gap-1.5"><PlayCircle className="w-4 h-4" /> Vista previa</span>
          <button onClick={() => setReveal({ i, step: 0 })} title="Reproducir de nuevo" className="p-2 rounded-full bg-white/15 text-white hover:bg-white/30"><Repeat className="w-5 h-5" /></button>
        </div>
      )}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        {!previewOne && <>
        <button onClick={() => setTool((t) => (t === 'laser' ? 'none' : 'laser'))} title="Puntero láser (L)" className={`p-2 rounded-full text-white transition-colors ${tool === 'laser' ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/30'}`}><Pointer className="w-5 h-5" /></button>
        <button onClick={() => setTool((t) => (t === 'pen' ? 'none' : 'pen'))} title="Lápiz (P)" className={`p-2 rounded-full text-white transition-colors ${tool === 'pen' ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/30'}`}><Pencil className="w-5 h-5" /></button>
        <button onClick={clearInk} title="Borrar tinta (E)" className="p-2 rounded-full bg-white/15 text-white hover:bg-white/30"><Eraser className="w-5 h-5" /></button>
        <button onClick={() => setBlacked((v) => !v)} title="Pantalla en negro (B)" className={`p-2 rounded-full text-white transition-colors ${blacked ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/30'}`}><Moon className="w-5 h-5" /></button>
        <button onClick={() => setGridNav((v) => !v)} title="Miniaturas (G)" className={`p-2 rounded-full text-white transition-colors ${gridNav ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/30'}`}><LayoutGrid className="w-5 h-5" /></button>
        {hasAuto && (
          <button onClick={() => setPaused((v) => !v)} title={paused ? 'Reanudar avance automático (K)' : 'Pausar avance automático (K)'} className={`p-2 rounded-full text-white transition-colors ${paused ? 'bg-amber-500/80' : 'bg-white/15 hover:bg-white/30'}`}>{paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}</button>
        )}
        {hasNotes && (
          <button onClick={() => setShowNotes((v) => !v)} title="Notas del orador (N)" className={`p-2 rounded-full text-white transition-colors ${showNotes ? 'bg-amber-500/80' : 'bg-white/15 hover:bg-white/30'}`}><StickyNote className="w-5 h-5" /></button>
        )}
        </>}
        <button onClick={onClose} title="Cerrar (Esc)" className="p-2 rounded-full bg-white/15 text-white hover:bg-white/30"><X className="w-5 h-5" /></button>
      </div>
      {stage}

      {/* Capa de interacción: tinta del lápiz + punto láser (sobre la diapositiva). */}
      <div ref={boxRef} className="absolute z-30" style={{ width: stageW, aspectRatio: aspect, pointerEvents: tool === 'none' ? 'none' : 'auto', cursor: tool === 'pen' ? 'crosshair' : tool === 'laser' ? 'none' : 'default' }}
        onPointerDown={(e) => { if (tool !== 'pen') return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); const [x, y] = slidePt(e); const stroke = [x, y]; drawRef.current = stroke; setInk((p) => ({ ...p, [i]: [...(p[i] || []), stroke] })); }}
        onPointerMove={(e) => { const [x, y] = slidePt(e); if (tool === 'laser') setLaser({ x, y }); else if (tool === 'pen' && drawRef.current) { drawRef.current.push(x, y); setInk((p) => ({ ...p })); } }}
        onPointerUp={() => { drawRef.current = null; }}
        onPointerLeave={() => { if (tool === 'laser') setLaser(null); }}>
        <svg viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          {(ink[i] || []).map((stroke, si) => (
            <polyline key={si} fill="none" stroke={inkColor} strokeWidth={0.55} strokeLinecap="round" strokeLinejoin="round"
              points={stroke.reduce((acc: string, n, idx) => acc + (idx % 2 === 0 ? `${n * 100},` : `${n * vbH} `), '')} />
          ))}
        </svg>
        {tool === 'laser' && laser && (
          <span className="absolute pointer-events-none" style={{ left: `${laser.x * 100}%`, top: `${laser.y * 100}%`, width: 18, height: 18, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.6) 40%, rgba(239,68,68,0) 70%)', boxShadow: '0 0 12px 4px rgba(239,68,68,0.6)' }} />
        )}
      </div>

      {/* Pantalla en negro. */}
      {blacked && <div className="absolute inset-0 z-40 bg-black" onClick={() => setBlacked(false)} />}

      {/* Navegador de miniaturas. */}
      {gridNav && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm overflow-y-auto p-8" onClick={() => setGridNav(false)}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto" onClick={(e) => e.stopPropagation()}>
            {decks.map((d, j) => (
              <button key={j} onClick={() => { setI(j); setGridNav(false); }}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${j === i ? 'border-rose-500 scale-[1.02]' : 'border-white/15 hover:border-white/40'}`} style={{ aspectRatio: aspect }}>
                <StaticDeck deck={d} master={master} />
                <span className="absolute top-1.5 left-2 text-xs font-bold text-white bg-black/50 rounded px-1.5">{j + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!previewOne && (
        <button onClick={() => { if (revealed > 0) setReveal({ i, step: Math.max(0, revealed - 1) }); else prevSlide(); }} disabled={i === 0 && revealed === 0} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20 z-20">‹</button>
      )}
      {!previewOne && (
        <button onClick={advance} disabled={i === slides.length - 1 && revealed >= maxStep && !loop} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white text-2xl hover:bg-white/30 disabled:opacity-20 z-20">›</button>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm z-20">{previewOne ? 'Vista previa' : `${i + 1} / ${slides.length}`}{maxStep > 0 && <span className="text-white/40"> · paso {revealed}/{maxStep}</span>}{!previewOne && loop && <span className="text-white/40" title="Bucle"> · ↻</span>}{!previewOne && hasAuto && paused && <span className="text-amber-400" title="En pausa"> · ⏸</span>}</div>
      {showNotes && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[30%] overflow-y-auto bg-black/80 backdrop-blur border-t border-white/10 px-8 py-4 text-white/90 text-sm leading-relaxed whitespace-pre-wrap z-20">
          {note || <span className="text-white/40">Sin notas para esta diapositiva.</span>}
        </div>
      )}
    </div>
  );
}
