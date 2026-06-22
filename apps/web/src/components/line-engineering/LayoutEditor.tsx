'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, Rect, Textbox, Line } from 'fabric';
import {
  Loader2, Save, Inbox, Hand, MousePointer2, Maximize2, ZoomIn, ZoomOut, Grid3x3,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Trash2, MapPin, RotateCcw,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const AMBER = '#f59e0b';
const VIEW_H = 560;
const PAD = 44; // px of breathing room around the footprint at zoom 1

interface LayoutStation {
  id: string; station: string; line: string; sequence: number; ctq: boolean;
  x: number | null; y: number | null; w: number | null; h: number | null; rotation: number | null;
}
interface Footprint { footprintW: number; footprintH: number; unit: string; gridSize: number }
interface LineLayout { model: string; revision: string; footprint: Footprint; stations: LayoutStation[] }
interface Placement { x: number; y: number; w: number; h: number; rotation: number }

/**
 * Labeled, resizable, rotatable station box. The label is drawn counter-scaled so
 * it stays crisp/constant regardless of the box size (scale is normalized back to
 * 1 on every transform end — see `object:modified`).
 */
class StationBox extends Rect {
  labelText = '';
  seqText = '';
  labelColor = '#0f172a';

  _render(ctx: CanvasRenderingContext2D) {
    // `_render` is fabric-internal (not in the public types), so call the base
    // implementation through the prototype rather than `super._render`.
    (Rect.prototype as any)._render.call(this, ctx);
    const sx = this.scaleX || 1;
    const sy = this.scaleY || 1;
    ctx.save();
    ctx.scale(1 / sx, 1 / sy);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.labelColor;
    if (this.seqText) {
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.globalAlpha = 0.6;
      ctx.fillText(this.seqText, 0, -9);
      ctx.globalAlpha = 1;
    }
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(this.labelText, 0, this.seqText ? 7 : 0);
    ctx.restore();
  }
}

export function LayoutEditor({ model, revision }: { model: string; revision: string }) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const fcRef = useRef<Canvas | null>(null);

  // World-state refs (mutated by fabric without re-rendering React on every drag).
  const placementsRef = useRef<Map<string, Placement>>(new Map());
  const objByIdRef = useRef<Map<string, StationBox>>(new Map());
  const sceneRef = useRef<any[]>([]);
  const guidesRef = useRef<Line[]>([]);
  const fitRef = useRef(1); // px per world-unit at zoom 1
  const footprintRef = useRef<Footprint>({ footprintW: 20000, footprintH: 10000, unit: 'mm', gridSize: 500 });
  const loadedPlacedRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [snap, setSnap] = useState(true);
  const [selCount, setSelCount] = useState(0);
  const [stations, setStations] = useState<LayoutStation[]>([]);
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set());
  const [footprint, setFootprint] = useState<Footprint>(footprintRef.current);
  const snapRef = useRef(snap);
  const panRef = useRef(panMode);
  useEffect(() => { snapRef.current = snap; }, [snap]);
  useEffect(() => { panRef.current = panMode; }, [panMode]);

  const unit = footprint.unit;
  const grid = footprint.gridSize;
  const fmt = useCallback((v: number) => {
    const n = unit === 'm' ? v : v / 1000; // show meters either way for the ruler
    return `${Number.isInteger(n) ? n : n.toFixed(1)} m`;
  }, [unit]);
  const placed = useMemo(() => stations.filter((s) => placedIds.has(s.id)), [stations, placedIds]);
  const tray = useMemo(() => stations.filter((s) => !placedIds.has(s.id)), [stations, placedIds]);

  const markDirty = useCallback(() => setDirty(true), []);

  // ── Fit scale: footprint fills the viewport (minus padding) at zoom 1 ───────
  const computeFit = useCallback(() => {
    const c = fcRef.current; const fp = footprintRef.current;
    if (!c) return 1;
    const vw = c.getWidth() - PAD * 2;
    const vh = c.getHeight() - PAD * 2;
    const s = Math.min(vw / fp.footprintW, vh / fp.footprintH);
    return s > 0 && Number.isFinite(s) ? s : 1;
  }, []);

  const worldToPx = (v: number) => v * fitRef.current;
  const pxToWorld = (v: number) => v / fitRef.current;
  const snapToGrid = (worldV: number) => Math.round(worldV / footprintRef.current.gridSize) * footprintRef.current.gridSize;

  // ── Static scene: footprint border, grid, ruler (non-interactive, behind) ───
  const drawScene = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    sceneRef.current.forEach((o) => c.remove(o));
    sceneRef.current = [];
    const fp = footprintRef.current;
    const W = worldToPx(fp.footprintW);
    const H = worldToPx(fp.footprintH);
    const add = (o: any) => { o.selectable = false; o.evented = false; o.hoverCursor = 'default'; sceneRef.current.push(o); c.add(o); };

    // Footprint floor
    add(new Rect({ left: 0, top: 0, width: W, height: H, fill: 'rgba(148,163,184,0.06)', stroke: 'rgba(100,116,139,0.55)', strokeWidth: 1.5, rx: 2, ry: 2 }));

    // Grid
    const stepPx = worldToPx(fp.gridSize);
    if (stepPx > 3) {
      for (let i = 1, x = stepPx; x < W - 0.5; i++, x = stepPx * i) {
        const major = i % 5 === 0;
        add(new Line([x, 0, x, H], { stroke: major ? 'rgba(100,116,139,0.32)' : 'rgba(100,116,139,0.14)', strokeWidth: major ? 1 : 0.5 }));
      }
      for (let i = 1, y = stepPx; y < H - 0.5; i++, y = stepPx * i) {
        const major = i % 5 === 0;
        add(new Line([0, y, W, y], { stroke: major ? 'rgba(100,116,139,0.32)' : 'rgba(100,116,139,0.14)', strokeWidth: major ? 1 : 0.5 }));
      }
    }

    // Ruler ticks (every 5 grid steps) along top + left, in real units.
    const majorWorld = fp.gridSize * 5;
    const label = (text: string, left: number, top: number) =>
      add(new Textbox(text, { left, top, width: 60, fontSize: 11, fill: 'rgba(100,116,139,0.9)', fontFamily: 'ui-sans-serif, system-ui, sans-serif', textAlign: 'center' }));
    for (let w = 0; w <= fp.footprintW + 1e-6; w += majorWorld) label(fmt(w), worldToPx(w) - 30, -22);
    for (let h = majorWorld; h <= fp.footprintH + 1e-6; h += majorWorld) label(fmt(h), -64, worldToPx(h) - 7);

    sceneRef.current.forEach((o) => c.sendObjectToBack(o));
  }, [fmt]);

  // ── Build an interactive station box from a placement ───────────────────────
  const makeBox = useCallback((s: LayoutStation, p: Placement) => {
    const c = fcRef.current; if (!c) return;
    const box = new StationBox({
      left: worldToPx(p.x), top: worldToPx(p.y), width: worldToPx(p.w), height: worldToPx(p.h),
      angle: p.rotation || 0, originX: 'left', originY: 'top',
      fill: s.ctq ? 'rgba(245,158,11,0.16)' : 'rgba(244,63,94,0.12)',
      stroke: s.ctq ? AMBER : ROSE, strokeWidth: 1.5, rx: 6, ry: 6,
      cornerColor: '#fff', cornerStrokeColor: ROSE, borderColor: ROSE, transparentCorners: false,
      cornerSize: 9, lockScalingFlip: true, objectCaching: false,
    });
    box.labelText = s.station;
    box.seqText = `#${s.sequence}`;
    (box as any).stationId = s.id;
    box.setControlsVisibility({ mtr: true });
    objByIdRef.current.set(s.id, box);
    c.add(box);
  }, []);

  // ── Full redraw of interactive objects from refs (structural changes only) ──
  const rebuild = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    objByIdRef.current.forEach((o) => c.remove(o));
    objByIdRef.current.clear();
    fitRef.current = computeFit();
    drawScene();
    placementsRef.current.forEach((p, id) => {
      const s = stationsRef.current.find((x) => x.id === id);
      if (s) makeBox(s, p);
    });
    c.requestRenderAll();
  }, [computeFit, drawScene, makeBox]);

  const stationsRef = useRef<LayoutStation[]>([]);
  useEffect(() => { stationsRef.current = stations; }, [stations]);

  // ── Snapping + smart guides while moving ────────────────────────────────────
  const clearGuides = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    guidesRef.current.forEach((g) => c.remove(g));
    guidesRef.current = [];
  }, []);

  const onMoving = useCallback((obj: StationBox) => {
    const c = fcRef.current; if (!c) return;
    clearGuides();
    const fp = footprintRef.current;
    const W = worldToPx(fp.footprintW), H = worldToPx(fp.footprintH);

    // Grid snap (world units → px)
    if (snapRef.current) {
      obj.set({ left: worldToPx(snapToGrid(pxToWorld(obj.left!))), top: worldToPx(snapToGrid(pxToWorld(obj.top!))) });
    }
    const bw = obj.getScaledWidth(), bh = obj.getScaledHeight();
    const tol = 6 / (c.getZoom() || 1);
    const myX = [obj.left!, obj.left! + bw / 2, obj.left! + bw];
    const myY = [obj.top!, obj.top! + bh / 2, obj.top! + bh];

    // Candidate edges from other boxes (+ footprint edges/center)
    const xs: number[] = [0, W / 2, W];
    const ys: number[] = [0, H / 2, H];
    objByIdRef.current.forEach((o) => {
      if (o === obj) return;
      const ow = o.getScaledWidth(), oh = o.getScaledHeight();
      xs.push(o.left!, o.left! + ow / 2, o.left! + ow);
      ys.push(o.top!, o.top! + oh / 2, o.top! + oh);
    });

    const guide = (x1: number, y1: number, x2: number, y2: number) => {
      const g = new Line([x1, y1, x2, y2], { stroke: '#3b82f6', strokeWidth: 1 / (c.getZoom() || 1), selectable: false, evented: false, strokeDashArray: [4, 4] });
      guidesRef.current.push(g); c.add(g);
    };
    for (let i = 0; i < myX.length; i++) for (const gx of xs) {
      if (Math.abs(myX[i] - gx) < tol) { obj.set({ left: obj.left! + (gx - myX[i]) }); guide(gx, -PAD, gx, H + PAD); break; }
    }
    for (let i = 0; i < myY.length; i++) for (const gy of ys) {
      if (Math.abs(myY[i] - gy) < tol) { obj.set({ top: obj.top! + (gy - myY[i]) }); guide(-PAD, gy, W + PAD, gy); break; }
    }
    obj.setCoords();
  }, [clearGuides]);

  // ── Persist a placement from an object back into the world-state ref ─────────
  const syncFromObj = useCallback((obj: StationBox) => {
    const id = (obj as any).stationId as string;
    if (!id) return;
    // normalize scale → width/height so future reads are clean
    const w = obj.getScaledWidth(), h = obj.getScaledHeight();
    obj.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
    obj.setCoords();
    placementsRef.current.set(id, {
      x: Math.max(0, Math.round(pxToWorld(obj.left!))),
      y: Math.max(0, Math.round(pxToWorld(obj.top!))),
      w: Math.max(1, Math.round(pxToWorld(w))),
      h: Math.max(1, Math.round(pxToWorld(h))),
      rotation: Math.round(obj.angle || 0),
    });
    markDirty();
  }, [markDirty]);

  // ── Load layout for the current scope ───────────────────────────────────────
  const load = useCallback(async () => {
    if (!model) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/line-engineering/layout?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`);
      if (!r.ok) throw new Error();
      const d = (await r.json()) as LineLayout;
      footprintRef.current = d.footprint;
      setFootprint(d.footprint);
      placementsRef.current = new Map();
      const placedSet = new Set<string>();
      d.stations.forEach((s) => {
        if (s.x !== null && s.y !== null) {
          placementsRef.current.set(s.id, {
            x: s.x, y: s.y,
            w: s.w ?? Math.round(d.footprint.footprintW * 0.06),
            h: s.h ?? Math.round(d.footprint.footprintH * 0.08),
            rotation: s.rotation ?? 0,
          });
          placedSet.add(s.id);
        }
      });
      loadedPlacedRef.current = new Set(placedSet);
      setStations(d.stations);
      stationsRef.current = d.stations;
      setPlacedIds(placedSet);
      setDirty(false);
      // defer rebuild until canvas is ready / state applied
      requestAnimationFrame(() => rebuild());
    } catch {
      toast.error('No se pudo cargar el layout.', 'Ing. Industrial');
    } finally {
      setLoading(false);
    }
  }, [model, revision, rebuild, toast]);

  // ── Canvas init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!elRef.current || fcRef.current) return;
    const width = wrapRef.current?.clientWidth ?? 900;
    const c = new Canvas(elRef.current, {
      width, height: VIEW_H, backgroundColor: 'transparent', selection: true,
      preserveObjectStacking: true, fireRightClick: false, stopContextMenu: true,
    });
    fcRef.current = c;
    // Center the footprint with padding initially.
    c.setViewportTransform([1, 0, 0, 1, PAD + 40, PAD + 8]);

    c.on('object:moving', (e) => onMoving(e.target as StationBox));
    c.on('object:modified', (e) => { clearGuides(); if (e.target) syncFromObj(e.target as StationBox); });
    c.on('mouse:up', () => clearGuides());
    c.on('selection:created', () => setSelCount(c.getActiveObjects().length));
    c.on('selection:updated', () => setSelCount(c.getActiveObjects().length));
    c.on('selection:cleared', () => setSelCount(0));

    // Wheel zoom to pointer
    c.on('mouse:wheel', (opt) => {
      const ev = opt.e as WheelEvent;
      let zoom = c.getZoom() * 0.999 ** ev.deltaY;
      zoom = Math.min(8, Math.max(0.1, zoom));
      c.zoomToPoint({ x: ev.offsetX, y: ev.offsetY } as any, zoom);
      ev.preventDefault(); ev.stopPropagation();
    });

    // Pan (pan-mode toggle, or Alt/middle drag)
    let panning = false; let lastX = 0; let lastY = 0;
    c.on('mouse:down', (opt) => {
      const ev = opt.e as MouseEvent;
      if (panRef.current || ev.altKey || (ev as any).button === 1) {
        panning = true; c.selection = false; lastX = ev.clientX; lastY = ev.clientY; c.setCursor('grabbing');
      }
    });
    c.on('mouse:move', (opt) => {
      if (!panning) return;
      const ev = opt.e as MouseEvent;
      const vpt = c.viewportTransform!;
      vpt[4] += ev.clientX - lastX; vpt[5] += ev.clientY - lastY;
      lastX = ev.clientX; lastY = ev.clientY; c.requestRenderAll();
    });
    c.on('mouse:up', () => { if (panning) { panning = false; c.selection = true; c.setViewportTransform(c.viewportTransform!); } });

    load();
    return () => { c.dispose(); fcRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when scope changes (after init). `load` is intentionally excluded so
  // we reload only on model/revision change, not on unrelated identity churn.
  useEffect(() => {
    if (fcRef.current) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, revision]);

  // Responsive width.
  useEffect(() => {
    const onResize = () => {
      const c = fcRef.current; if (!c || !wrapRef.current) return;
      c.setDimensions({ width: wrapRef.current.clientWidth, height: VIEW_H });
      fitRef.current = computeFit(); rebuild();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeFit, rebuild]);

  // ── Place / unplace ─────────────────────────────────────────────────────────
  const placeStation = useCallback((s: LayoutStation) => {
    const c = fcRef.current; if (!c) return;
    const fp = footprintRef.current;
    // drop near the centre of the current viewport, snapped to grid
    const center = c.getVpCenter();
    const w = Math.max(fp.gridSize * 2, Math.round(fp.footprintW * 0.06));
    const h = Math.max(fp.gridSize * 2, Math.round(fp.footprintH * 0.08));
    const x = snapToGrid(Math.max(0, pxToWorld(center.x) - w / 2));
    const y = snapToGrid(Math.max(0, pxToWorld(center.y) - h / 2));
    placementsRef.current.set(s.id, { x, y, w, h, rotation: 0 });
    setPlacedIds((prev) => new Set(prev).add(s.id));
    markDirty();
    requestAnimationFrame(() => { rebuild(); const o = objByIdRef.current.get(s.id); if (o) { c.setActiveObject(o); c.requestRenderAll(); } });
  }, [markDirty, rebuild]);

  const unplaceSelected = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    const objs = c.getActiveObjects() as StationBox[];
    const ids = objs.map((o) => (o as any).stationId as string).filter(Boolean);
    if (ids.length === 0) return;
    c.discardActiveObject();
    setPlacedIds((prev) => { const n = new Set(prev); ids.forEach((id) => { n.delete(id); placementsRef.current.delete(id); }); return n; });
    markDirty();
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild]);

  // ── Align / distribute (on the active multi-selection) ──────────────────────
  const align = useCallback((kind: string) => {
    const c = fcRef.current; if (!c) return;
    const objs = c.getActiveObjects() as StationBox[];
    if (objs.length < 2) return;
    c.discardActiveObject();
    const rects = objs.map((o) => ({ o, r: o.getBoundingRect() }));
    if (kind === 'left') { const m = Math.min(...rects.map((x) => x.r.left)); rects.forEach((x) => x.o.set({ left: x.o.left! + (m - x.r.left) })); }
    if (kind === 'right') { const m = Math.max(...rects.map((x) => x.r.left + x.r.width)); rects.forEach((x) => x.o.set({ left: x.o.left! + (m - (x.r.left + x.r.width)) })); }
    if (kind === 'cx') { const m = rects.reduce((a, x) => a + x.r.left + x.r.width / 2, 0) / rects.length; rects.forEach((x) => x.o.set({ left: x.o.left! + (m - (x.r.left + x.r.width / 2)) })); }
    if (kind === 'top') { const m = Math.min(...rects.map((x) => x.r.top)); rects.forEach((x) => x.o.set({ top: x.o.top! + (m - x.r.top) })); }
    if (kind === 'bottom') { const m = Math.max(...rects.map((x) => x.r.top + x.r.height)); rects.forEach((x) => x.o.set({ top: x.o.top! + (m - (x.r.top + x.r.height)) })); }
    if (kind === 'cy') { const m = rects.reduce((a, x) => a + x.r.top + x.r.height / 2, 0) / rects.length; rects.forEach((x) => x.o.set({ top: x.o.top! + (m - (x.r.top + x.r.height / 2)) })); }
    if (kind === 'dx' && rects.length > 2) {
      const sorted = [...rects].sort((a, b) => (a.r.left + a.r.width / 2) - (b.r.left + b.r.width / 2));
      const first = sorted[0].r.left + sorted[0].r.width / 2, last = sorted[sorted.length - 1].r.left + sorted[sorted.length - 1].r.width / 2;
      const gap = (last - first) / (sorted.length - 1);
      sorted.forEach((x, i) => { const target = first + gap * i; x.o.set({ left: x.o.left! + (target - (x.r.left + x.r.width / 2)) }); });
    }
    if (kind === 'dy' && rects.length > 2) {
      const sorted = [...rects].sort((a, b) => (a.r.top + a.r.height / 2) - (b.r.top + b.r.height / 2));
      const first = sorted[0].r.top + sorted[0].r.height / 2, last = sorted[sorted.length - 1].r.top + sorted[sorted.length - 1].r.height / 2;
      const gap = (last - first) / (sorted.length - 1);
      sorted.forEach((x, i) => { const target = first + gap * i; x.o.set({ top: x.o.top! + (target - (x.r.top + x.r.height / 2)) }); });
    }
    rects.forEach((x) => { x.o.setCoords(); syncFromObj(x.o); });
    c.requestRenderAll();
  }, [syncFromObj]);

  // Keyboard: nudge / delete (unplace). Ignored while typing in inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = fcRef.current; if (!c) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      const objs = c.getActiveObjects() as StationBox[];
      if (objs.length === 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); unplaceSelected(); return;
      }
      const step = (e.shiftKey ? 1 : footprintRef.current.gridSize) * fitRef.current;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (e.key in d) {
        e.preventDefault();
        objs.forEach((o) => { o.set({ left: o.left! + d[e.key][0], top: o.top! + d[e.key][1] }); o.setCoords(); syncFromObj(o); });
        c.requestRenderAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Zoom helpers ────────────────────────────────────────────────────────────
  const zoomBy = (f: number) => { const c = fcRef.current; if (!c) return; const z = Math.min(8, Math.max(0.1, c.getZoom() * f)); c.zoomToPoint({ x: c.getWidth() / 2, y: c.getHeight() / 2 } as any, z); };
  const fitView = useCallback(() => { const c = fcRef.current; if (!c) return; c.setViewportTransform([1, 0, 0, 1, PAD + 40, PAD + 8]); fitRef.current = computeFit(); rebuild(); }, [computeFit, rebuild]);

  // ── Footprint config edits ──────────────────────────────────────────────────
  const updateFootprint = (patch: Partial<Footprint>) => {
    const next = { ...footprintRef.current, ...patch };
    footprintRef.current = next; setFootprint(next); markDirty();
    requestAnimationFrame(() => { fitRef.current = computeFit(); rebuild(); });
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!model) return;
    setSaving(true);
    try {
      const positions = [...placementsRef.current.entries()].map(([id, p]) => ({ id, ...p }));
      const cleared = [...loadedPlacedRef.current].filter((id) => !placementsRef.current.has(id));
      const r = await apiFetch(`${API_BASE}/line-engineering/layout`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, revision, footprint: footprintRef.current, positions, cleared }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d?.message || 'No se pudo guardar.', 'Ing. Industrial'); return; }
      toast.success('Layout guardado.', 'Ing. Industrial');
      loadedPlacedRef.current = new Set(placementsRef.current.keys());
      setDirty(false);
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setSaving(false); }
  }, [model, revision, toast]);

  if (!model) {
    return (
      <div className={`${glass} rounded-3xl p-12 text-center`}>
        <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <h3 className="font-semibold">Elige un modelo</h3>
        <p className="text-sm text-gray-400 mt-1">Selecciona un modelo arriba para disponer su layout físico.</p>
      </div>
    );
  }

  return (
    <div className={`${glass} rounded-2xl overflow-hidden`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/5 dark:border-white/10 flex-wrap">
        <TBtn active={!panMode} onClick={() => setPanMode(false)} title="Seleccionar"><MousePointer2 className="w-4 h-4" /></TBtn>
        <TBtn active={panMode} onClick={() => setPanMode(true)} title="Mover lienzo (pan)"><Hand className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn onClick={() => zoomBy(1.2)} title="Acercar"><ZoomIn className="w-4 h-4" /></TBtn>
        <TBtn onClick={() => zoomBy(1 / 1.2)} title="Alejar"><ZoomOut className="w-4 h-4" /></TBtn>
        <TBtn onClick={fitView} title="Ajustar"><Maximize2 className="w-4 h-4" /></TBtn>
        <TBtn active={snap} onClick={() => setSnap((v) => !v)} title="Snap a grilla"><Grid3x3 className="w-4 h-4" /></TBtn>
        <Sep />
        <div className={`flex items-center gap-1 ${selCount < 2 ? 'opacity-40 pointer-events-none' : ''}`}>
          <TBtn onClick={() => align('left')} title="Alinear izquierda"><AlignHorizontalJustifyStart className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('cx')} title="Centrar horizontal"><AlignHorizontalJustifyCenter className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('right')} title="Alinear derecha"><AlignHorizontalJustifyEnd className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('top')} title="Alinear arriba"><AlignVerticalJustifyStart className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('cy')} title="Centrar vertical"><AlignVerticalJustifyCenter className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('bottom')} title="Alinear abajo"><AlignVerticalJustifyEnd className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('dx')} title="Distribuir horizontal"><AlignHorizontalSpaceAround className="w-4 h-4" /></TBtn>
          <TBtn onClick={() => align('dy')} title="Distribuir vertical"><AlignVerticalSpaceAround className="w-4 h-4" /></TBtn>
        </div>
        <Sep />
        <TBtn onClick={unplaceSelected} title="Quitar del plano (Supr)"><Trash2 className="w-4 h-4" /></TBtn>
        <div className="flex-1" />
        <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: ROSE }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
        </button>
      </div>

      {/* Footprint config */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] text-gray-500 flex-wrap">
        <span className="font-medium">Footprint:</span>
        <label className="flex items-center gap-1">Ancho<input type="number" min={1} value={footprint.footprintW} onChange={(e) => updateFootprint({ footprintW: Math.max(1, Number(e.target.value) || 1) })} className="w-20 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
        <span>×</span>
        <label className="flex items-center gap-1">Largo<input type="number" min={1} value={footprint.footprintH} onChange={(e) => updateFootprint({ footprintH: Math.max(1, Number(e.target.value) || 1) })} className="w-20 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
        <label className="flex items-center gap-1">Unidad
          <select value={footprint.unit} onChange={(e) => updateFootprint({ unit: e.target.value })} className="rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10">
            <option value="mm">mm</option><option value="m">m</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Grilla<input type="number" min={1} value={footprint.gridSize} onChange={(e) => updateFootprint({ gridSize: Math.max(1, Number(e.target.value) || 1) })} className="w-16 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
        <span className="text-gray-400">· {grid}{unit} por celda</span>
      </div>

      <div className="flex">
        {/* Tray of stations not yet placed */}
        <div className="w-52 shrink-0 border-r border-black/5 dark:border-white/10 p-3 max-h-[560px] overflow-y-auto">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Por colocar ({tray.length})</div>
          {stations.length === 0 ? (
            <p className="text-[12px] text-gray-400">Este modelo aún no tiene estaciones. Créalas en la pestaña Balanceo.</p>
          ) : tray.length === 0 ? (
            <p className="text-[12px] text-gray-400">Todas las estaciones están en el plano.</p>
          ) : (
            <div className="space-y-1.5">
              {tray.map((s) => (
                <button key={s.id} onClick={() => placeStation(s)} className="w-full text-left px-2.5 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-400">#{s.sequence}</span>
                    <span className="text-[13px] font-medium truncate flex-1">{s.station}</span>
                    {s.ctq && <span className="w-1.5 h-1.5 rounded-full" style={{ background: AMBER }} />}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 group-hover:text-rose-500">{s.line} · clic para colocar</div>
                </button>
              ))}
            </div>
          )}
          {placed.length > 0 && (
            <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 text-[11px] text-gray-400">{placed.length} en el plano</div>
          )}
        </div>

        {/* Canvas */}
        <div ref={wrapRef} className="relative flex-1 min-w-0 bg-gradient-to-br from-black/[0.015] to-transparent dark:from-white/[0.02]" style={{ height: VIEW_H }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          )}
          {!loading && stations.length > 0 && placed.length === 0 && (
            <div className="absolute inset-0 grid place-items-center z-10 pointer-events-none">
              <div className="text-center px-6">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <h3 className="font-semibold text-sm">Coloca tu primera estación</h3>
                <p className="text-[12px] text-gray-400 mt-1 max-w-xs">Haz clic en una estación de la izquierda para soltarla en el plano, luego arrástrala, redimensiona o rota.</p>
              </div>
            </div>
          )}
          <canvas ref={elRef} />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 text-[11px] text-gray-400 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Arrastra, redimensiona y rota</span>
        <span>· Flechas: mover (Shift = fino)</span>
        <span>· Supr: quitar del plano</span>
        <span>· Rueda: zoom · Espacio/Pan: desplazar</span>
        {dirty && <span className="ml-auto text-rose-500 font-medium">Cambios sin guardar</span>}
      </div>
    </div>
  );
}

function TBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-rose-500/15 text-rose-500' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
      {children}
    </button>
  );
}
function Sep() { return <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5" />; }
