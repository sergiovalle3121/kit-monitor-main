'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, Rect, Textbox, Line, Polyline, Polygon, Group } from 'fabric';
import {
  Loader2, Save, Inbox, Hand, MousePointer2, Maximize2, ZoomIn, ZoomOut, Grid3x3,
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Trash2, MapPin, RotateCcw,
  Upload, Eye, EyeOff, Map as MapIcon, Activity, Workflow, Wand2, Boxes,
  Download, Printer, Ruler, Type, MoveHorizontal, CopyPlus, X, Flame, Waypoints,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { parseDxf, type DxfModel } from './dxf';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const AMBER = '#f59e0b';
const VIEW_H = 560;
const PAD = 44; // px of breathing room around the footprint at zoom 1

// Live MES overlay colours (Fase 3).
const MES_COLORS: Record<string, { fill: string; stroke: string }> = {
  down: { fill: 'rgba(239,68,68,0.22)', stroke: '#ef4444' },
  warn: { fill: 'rgba(245,158,11,0.20)', stroke: '#f59e0b' },
  ok: { fill: 'rgba(16,185,129,0.18)', stroke: '#10b981' },
  idle: { fill: 'rgba(148,163,184,0.14)', stroke: '#94a3b8' },
  unknown: { fill: 'rgba(148,163,184,0.10)', stroke: '#cbd5e1' },
};

// Cycle-time / utilization heatmap ramp (Fase 9). cold → over (cool blue to hot red).
type HeatLevel = 'cold' | 'cool' | 'warm' | 'hot' | 'over';
const HEAT_COLORS: Record<HeatLevel, { fill: string; stroke: string }> = {
  cold: { fill: 'rgba(59,130,246,0.20)', stroke: '#3b82f6' },
  cool: { fill: 'rgba(6,182,212,0.20)', stroke: '#06b6d4' },
  warm: { fill: 'rgba(245,158,11,0.22)', stroke: '#f59e0b' },
  hot: { fill: 'rgba(249,115,22,0.26)', stroke: '#f97316' },
  over: { fill: 'rgba(239,68,68,0.30)', stroke: '#ef4444' },
};
const HEAT_LABEL: Record<HeatLevel, string> = {
  cold: 'Holgado', cool: 'Ligero', warm: 'Medio', hot: 'Alto', over: 'Sobre takt',
};
interface StationHeat {
  station: string; line: string; sequence: number; cycleTimeSec: number;
  utilizationPct: number; loadPct: number; heat: number; level: HeatLevel;
  bottleneck: boolean; overTakt: boolean;
}
interface HeatSummary {
  taktSec: number; lineCycleTimeSec: number; bottleneckStation: string | null;
  maxCycleTimeSec: number; avgCycleTimeSec: number; balancePct: number;
  updatedAt: string; stations: StationHeat[];
}

// Material-flow analysis (Fase 10). Per-segment distances render live on the
// canvas; this summary (totals + crossings) comes from the backend geometry.
interface FlowSegment { from: string; to: string; fromStation: string; toStation: string; distance: number; kind?: string }
interface FlowSummary {
  totalDistance: number; segmentCount: number; longestSegment: FlowSegment | null;
  avgDistance: number; unplacedLinks: number; crossings: number; unit: string; segments: FlowSegment[];
}
// Short hops green, long hauls red — the spaghetti ramp, normalized to the longest.
const flowColor = (d: number, max: number): string => {
  const t = max > 0 ? d / max : 0;
  if (t >= 0.7) return '#ef4444';
  if (t >= 0.4) return '#f59e0b';
  return '#10b981';
};

// Equipment / asset palette (Fase 5). `w`/`h` are default sizes in layout units.
const ASSET_KINDS: { kind: string; label: string; color: string; fill: string; w: number; h: number }[] = [
  { kind: 'workbench', label: 'Mesa', color: '#3b82f6', fill: 'rgba(59,130,246,0.10)', w: 1200, h: 800 },
  { kind: 'conveyor', label: 'Transportador', color: '#7c3aed', fill: 'rgba(124,58,237,0.10)', w: 2400, h: 500 },
  { kind: 'rack', label: 'Rack', color: '#f59e0b', fill: 'rgba(245,158,11,0.10)', w: 900, h: 450 },
  { kind: 'robot', label: 'Robot', color: '#ef4444', fill: 'rgba(239,68,68,0.10)', w: 700, h: 700 },
  { kind: 'aoi', label: 'AOI', color: '#10b981', fill: 'rgba(16,185,129,0.10)', w: 900, h: 700 },
  { kind: 'oven', label: 'Horno', color: '#f97316', fill: 'rgba(249,115,22,0.10)', w: 1800, h: 900 },
  { kind: 'printer', label: 'Impresora', color: '#64748b', fill: 'rgba(100,116,139,0.10)', w: 600, h: 500 },
  { kind: 'wall', label: 'Muro', color: '#94a3b8', fill: 'rgba(148,163,184,0.20)', w: 3000, h: 150 },
  { kind: 'zone', label: 'Zona', color: '#0ea5e9', fill: 'rgba(14,165,233,0.06)', w: 3000, h: 2000 },
];
const ASSET_META = (kind: string) => ASSET_KINDS.find((k) => k.kind === kind) ?? ASSET_KINDS[0];

interface LayoutAsset { id: string; kind: string; x: number; y: number; w: number; h: number; rotation: number; label?: string }
interface LayoutAnnotation { id: string; type: 'text' | 'dim'; x: number; y: number; x2?: number; y2?: number; text?: string; color?: string }
interface LayoutStation {
  id: string; station: string; line: string; sequence: number; ctq: boolean;
  x: number | null; y: number | null; w: number | null; h: number | null; rotation: number | null;
}
interface Footprint { footprintW: number; footprintH: number; unit: string; gridSize: number }
interface DxfMeta { name: string; offsetX: number; offsetY: number; scale: number; rotation: number; visible: boolean; opacity: number }
interface LayoutConnector { from: string; to: string; kind?: string }
interface LineLayout { model: string; revision: string; footprint: Footprint; stations: LayoutStation[]; dxf: DxfMeta | null; connectors: LayoutConnector[]; assets: LayoutAsset[]; annotations: LayoutAnnotation[] }
interface Placement { x: number; y: number; w: number; h: number; rotation: number }
type MesLevel = 'down' | 'warn' | 'ok' | 'idle' | 'unknown';
interface StationLiveStatus { station: string; line: string; status: MesLevel; label: string; severity: string | null; since: string | null }
interface StatusSummary { running: boolean; updatedAt: string; counts: Record<MesLevel, number>; stations: StationLiveStatus[] }

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

export function LayoutEditor({ model, revision, models = [] }: { model: string; revision: string; models?: { model: string; revision: string }[] }) {
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
  const dxfModelRef = useRef<DxfModel | null>(null); // parsed geometry (normalised)
  const dxfMetaRef = useRef<DxfMeta | null>(null);
  const dxfGroupRef = useRef<Group | null>(null);
  const mesOnRef = useRef(false);
  const statusRef = useRef<Map<string, StationLiveStatus>>(new Map());
  const heatOnRef = useRef(false);
  const heatRef = useRef<Map<string, StationHeat>>(new Map());
  const flowOnRef = useRef(false);
  const connectorsRef = useRef<LayoutConnector[]>([]);
  const connObjsRef = useRef<any[]>([]);
  const linkRef = useRef(false);
  const linkSourceRef = useRef<string | null>(null);
  const drawConnRef = useRef<() => void>(() => {});
  const linkClickRef = useRef<(t: any) => void>(() => {});
  const assetsRef = useRef<LayoutAsset[]>([]);
  const objByAssetRef = useRef<Map<string, StationBox>>(new Map());
  const measureRef = useRef(false);
  const measureP1Ref = useRef<{ x: number; y: number } | null>(null);
  const measureObjsRef = useRef<any[]>([]);
  const measureClickRef = useRef<(p: { x: number; y: number }) => void>(() => {});
  const annotationsRef = useRef<LayoutAnnotation[]>([]);
  const objByAnnRef = useRef<Map<string, any>>(new Map());
  const annToolRef = useRef<'text' | 'dim' | null>(null);
  const annDimP1Ref = useRef<{ x: number; y: number } | null>(null);
  const annClickRef = useRef<(scene: { x: number; y: number }, target: any) => void>(() => {});
  const drawAnnRef = useRef<() => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [snap, setSnap] = useState(true);
  const [selCount, setSelCount] = useState(0);
  const [stations, setStations] = useState<LayoutStation[]>([]);
  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set());
  const [footprint, setFootprint] = useState<Footprint>(footprintRef.current);
  const [dxf, setDxf] = useState<DxfMeta | null>(null);
  const [dxfBusy, setDxfBusy] = useState(false);
  const [mesOn, setMesOn] = useState(false);
  const [mesData, setMesData] = useState<StatusSummary | null>(null);
  const [heatOn, setHeatOn] = useState(false);
  const [heatData, setHeatData] = useState<HeatSummary | null>(null);
  const [taktInput, setTaktInput] = useState('');
  const [flowOn, setFlowOn] = useState(false);
  const [flowData, setFlowData] = useState<FlowSummary | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [connCount, setConnCount] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureVal, setMeasureVal] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [annTool, setAnnTool] = useState<'text' | 'dim' | null>(null);
  const [annCount, setAnnCount] = useState(0);
  const [showClone, setShowClone] = useState(false);
  const [cloneSrc, setCloneSrc] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);
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
  // Any interaction tool active → station/asset boxes yield clicks to the tool.
  const toolActive = useCallback(() => linkRef.current || measureRef.current || !!annToolRef.current, []);

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

  // ── DXF background: map the parsed plan to scene px and draw it (read-only) ──
  const drawDxf = useCallback(() => {
    const c = fcRef.current;
    if (dxfGroupRef.current) { c?.remove(dxfGroupRef.current); dxfGroupRef.current = null; }
    const model = dxfModelRef.current;
    const meta = dxfMetaRef.current;
    if (!c || !model || !meta || !meta.visible) return;

    const S = fitRef.current;
    const { scale, offsetX: ox, offsetY: oy } = meta;
    const cx = (model.width * scale) / 2 + ox; // rotation pivot (world units)
    const cy = (model.height * scale) / 2 + oy;
    const rad = ((meta.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const map = (px: number, py: number) => {
      const wx0 = px * scale + ox, wy0 = py * scale + oy;
      const dx = wx0 - cx, dy = wy0 - cy;
      return {
        x: (cx + dx * cos - dy * sin) * S,
        y: (cy + dx * sin + dy * cos) * S,
      };
    };
    const polylines = model.polylines.map((flat) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) pts.push(map(flat[i], flat[i + 1]));
      return new Polyline(pts, {
        stroke: 'rgba(51,65,85,0.85)', strokeWidth: 1, fill: '',
        selectable: false, evented: false, objectCaching: false, strokeUniform: true,
      });
    });
    const group = new Group(polylines, {
      selectable: false, evented: false, hoverCursor: 'default',
      opacity: Math.min(1, Math.max(0, meta.opacity)),
    });
    dxfGroupRef.current = group;
    c.add(group);
    // Above the grid/footprint, below the stations (added after this in rebuild).
    sceneRef.current.forEach((o) => c.sendObjectToBack(o));
  }, []);

  // ── Flow connectors: arrows between placed stations (Fase 4) ────────────────
  const drawConnectors = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    connObjsRef.current.forEach((o) => c.remove(o));
    connObjsRef.current = [];
    const S = fitRef.current;
    const flow = flowOnRef.current;
    const edge = (cx: number, cy: number, hw: number, hh: number, dx: number, dy: number) => {
      const t = 1 / Math.max(Math.abs(dx) / (hw || 1), Math.abs(dy) / (hh || 1), 1e-6);
      return { x: cx + dx * t, y: cy + dy * t };
    };
    // In flow mode, color hops by length relative to the longest currently drawn.
    const worldDist = (conn: LayoutConnector) => {
      const a = placementsRef.current.get(conn.from);
      const b = placementsRef.current.get(conn.to);
      if (!a || !b) return 0;
      return Math.hypot((b.x + b.w / 2) - (a.x + a.w / 2), (b.y + b.h / 2) - (a.y + a.h / 2));
    };
    const flowMax = flow
      ? connectorsRef.current.reduce((m, conn) => Math.max(m, worldDist(conn)), 0)
      : 0;
    connectorsRef.current.forEach((conn, idx) => {
      const a = placementsRef.current.get(conn.from);
      const b = placementsRef.current.get(conn.to);
      if (!a || !b) return; // only draw when both ends are placed
      const ac = { x: (a.x + a.w / 2) * S, y: (a.y + a.h / 2) * S };
      const bc = { x: (b.x + b.w / 2) * S, y: (b.y + b.h / 2) * S };
      let dx = bc.x - ac.x, dy = bc.y - ac.y;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const p1 = edge(ac.x, ac.y, (a.w / 2) * S, (a.h / 2) * S, dx, dy);
      const p2 = edge(bc.x, bc.y, (b.w / 2) * S, (b.h / 2) * S, -dx, -dy);
      const wd = flow ? worldDist(conn) : 0;
      const color = flow
        ? flowColor(wd, flowMax)
        : (conn.kind === 'conveyor' ? '#7c3aed' : conn.kind === 'return' ? '#94a3b8' : '#3b82f6');
      const line = new Line([p1.x, p1.y, p2.x, p2.y], {
        stroke: color, strokeWidth: flow ? 2.5 : 2, selectable: false, evented: linkRef.current,
        hoverCursor: 'pointer', strokeDashArray: conn.kind === 'return' ? [6, 4] : undefined, strokeUniform: true,
      });
      (line as any).connIdx = idx;
      const ang = Math.atan2(dy, dx), H = 10;
      const head = new Polygon([
        { x: p2.x, y: p2.y },
        { x: p2.x - H * Math.cos(ang - Math.PI / 7), y: p2.y - H * Math.sin(ang - Math.PI / 7) },
        { x: p2.x - H * Math.cos(ang + Math.PI / 7), y: p2.y - H * Math.sin(ang + Math.PI / 7) },
      ], { fill: color, selectable: false, evented: false, objectCaching: false });
      connObjsRef.current.push(line, head);
      c.add(line); c.add(head);
      if (flow) {
        const lbl = new Textbox(`${Math.round(wd)} ${footprintRef.current.unit}`, {
          left: (p1.x + p2.x) / 2 - 40, top: (p1.y + p2.y) / 2 - 8, width: 80, fontSize: 11,
          fill: color, textAlign: 'center', selectable: false, evented: false,
          backgroundColor: 'rgba(255,255,255,0.82)',
        });
        connObjsRef.current.push(lbl);
        c.add(lbl);
      }
    });
  }, []);
  useEffect(() => { drawConnRef.current = drawConnectors; }, [drawConnectors]);

  // ── Annotations: text labels + dimension lines (Fase 7) ─────────────────────
  const drawAnnotations = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    objByAnnRef.current.forEach((o) => c.remove(o));
    objByAnnRef.current.clear();
    const S = fitRef.current;
    const tool = annToolRef.current;
    annotationsRef.current.forEach((a) => {
      if (a.type === 'text') {
        const t = new Textbox(a.text || 'Texto', {
          left: a.x * S, top: a.y * S, width: 220, fontSize: 16, fill: a.color || '#0f172a',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif', editable: true,
          selectable: !tool, evented: true, backgroundColor: 'rgba(255,255,255,0.55)',
        });
        (t as any).annId = a.id; (t as any).annType = 'text';
        objByAnnRef.current.set(a.id, t); c.add(t);
      } else {
        const x1 = a.x * S, y1 = a.y * S, x2 = (a.x2 ?? a.x) * S, y2 = (a.y2 ?? a.y) * S;
        const dist = Math.hypot((a.x2 ?? a.x) - a.x, (a.y2 ?? a.y) - a.y);
        const color = a.color || '#0ea5e9';
        const line = new Line([x1, y1, x2, y2], { stroke: color, strokeWidth: 1.5, strokeDashArray: [5, 4], selectable: false, evented: tool === 'dim', hoverCursor: 'pointer', strokeUniform: true });
        (line as any).annId = a.id;
        const label = new Textbox(`${Math.round(dist)} ${footprintRef.current.unit}`, { left: (x1 + x2) / 2 - 50, top: (y1 + y2) / 2 - 16, width: 100, fontSize: 12, fill: color, textAlign: 'center', selectable: false, evented: false, backgroundColor: 'rgba(255,255,255,0.85)' });
        objByAnnRef.current.set(a.id, line);
        objByAnnRef.current.set(`${a.id}:lbl`, label);
        c.add(line); c.add(label);
      }
    });
  }, []);
  useEffect(() => { drawAnnRef.current = drawAnnotations; }, [drawAnnotations]);

  // Overlay tint for a station box: heatmap (Fase 9) wins over live MES (Fase 3)
  // when both are toggled; null means the default CTQ/normal styling applies.
  const overlayFor = useCallback((stationName: string): { fill: string; stroke: string } | null => {
    if (heatOnRef.current) {
      const h = heatRef.current.get(stationName);
      return h ? HEAT_COLORS[h.level] : null;
    }
    if (mesOnRef.current) {
      const st = statusRef.current.get(stationName);
      return st ? MES_COLORS[st.status] : null;
    }
    return null;
  }, []);

  // ── Build an interactive station box from a placement ───────────────────────
  const makeBox = useCallback((s: LayoutStation, p: Placement) => {
    const c = fcRef.current; if (!c) return;
    const col = overlayFor(s.station);
    const box = new StationBox({
      left: worldToPx(p.x), top: worldToPx(p.y), width: worldToPx(p.w), height: worldToPx(p.h),
      angle: p.rotation || 0, originX: 'left', originY: 'top',
      fill: col ? col.fill : (s.ctq ? 'rgba(245,158,11,0.16)' : 'rgba(244,63,94,0.12)'),
      stroke: col ? col.stroke : (s.ctq ? AMBER : ROSE), strokeWidth: col ? 2 : 1.5, rx: 6, ry: 6,
      cornerColor: '#fff', cornerStrokeColor: ROSE, borderColor: ROSE, transparentCorners: false,
      cornerSize: 9, lockScalingFlip: true, objectCaching: false,
      selectable: !toolActive(), // tools (link/measure/text/dim) take the click
    });
    box.labelText = s.station;
    box.seqText = `#${s.sequence}`;
    (box as any).stationId = s.id;
    (box as any).stationName = s.station;
    box.setControlsVisibility({ mtr: true });
    objByIdRef.current.set(s.id, box);
    c.add(box);
  }, [toolActive, overlayFor]);

  // ── Build an equipment/asset box (Fase 5) ───────────────────────────────────
  const makeAsset = useCallback((a: LayoutAsset) => {
    const c = fcRef.current; if (!c) return;
    const meta = ASSET_META(a.kind);
    const inactive = !toolActive();
    const box = new StationBox({
      left: worldToPx(a.x), top: worldToPx(a.y), width: worldToPx(a.w), height: worldToPx(a.h),
      angle: a.rotation || 0, originX: 'left', originY: 'top',
      fill: meta.fill, stroke: meta.color, strokeWidth: 1.5, rx: 4, ry: 4, strokeDashArray: [6, 4],
      cornerColor: '#fff', cornerStrokeColor: meta.color, borderColor: meta.color, transparentCorners: false,
      cornerSize: 9, lockScalingFlip: true, objectCaching: false,
      selectable: inactive, evented: inactive,
    });
    box.labelText = a.label || meta.label;
    box.seqText = '';
    box.labelColor = '#334155';
    (box as any).assetId = a.id;
    box.setControlsVisibility({ mtr: true });
    objByAssetRef.current.set(a.id, box);
    c.add(box);
  }, [toolActive]);

  // ── Full redraw of interactive objects from refs (structural changes only) ──
  const rebuild = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    objByIdRef.current.forEach((o) => c.remove(o));
    objByIdRef.current.clear();
    objByAssetRef.current.forEach((o) => c.remove(o));
    objByAssetRef.current.clear();
    fitRef.current = computeFit();
    drawScene();
    drawDxf();
    assetsRef.current.forEach((a) => makeAsset(a)); // equipment under the stations
    placementsRef.current.forEach((p, id) => {
      const s = stationsRef.current.find((x) => x.id === id);
      if (s) makeBox(s, p);
    });
    drawConnectors(); // arrows on top of the stations
    drawAnnotations(); // text labels + dimensions on top
    c.requestRenderAll();
  }, [computeFit, drawScene, drawDxf, drawConnectors, drawAnnotations, makeBox, makeAsset]);

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
    const w = obj.getScaledWidth(), h = obj.getScaledHeight();
    // Text annotation moved (Fase 7).
    const annId = (obj as any).annId as string | undefined;
    if (annId) {
      const a = annotationsRef.current.find((x) => x.id === annId);
      if (a) { a.x = Math.max(0, Math.round(pxToWorld(obj.left!))); a.y = Math.max(0, Math.round(pxToWorld(obj.top!))); markDirty(); }
      return;
    }
    // Equipment/asset boxes (Fase 5) live in their own ref.
    const aid = (obj as any).assetId as string | undefined;
    if (aid) {
      obj.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
      obj.setCoords();
      const a = assetsRef.current.find((x) => x.id === aid);
      if (a) {
        a.x = Math.max(0, Math.round(pxToWorld(obj.left!)));
        a.y = Math.max(0, Math.round(pxToWorld(obj.top!)));
        a.w = Math.max(1, Math.round(pxToWorld(w)));
        a.h = Math.max(1, Math.round(pxToWorld(h)));
        a.rotation = Math.round(obj.angle || 0);
      }
      markDirty();
      return;
    }
    const id = (obj as any).stationId as string;
    if (!id) return;
    // normalize scale → width/height so future reads are clean
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
    drawConnRef.current(); // keep arrows attached as the box moves
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
      connectorsRef.current = Array.isArray(d.connectors) ? d.connectors : [];
      setConnCount(connectorsRef.current.length);
      assetsRef.current = Array.isArray(d.assets) ? d.assets : [];
      annotationsRef.current = Array.isArray(d.annotations) ? d.annotations : [];
      setAnnCount(annotationsRef.current.length);
      setDirty(false);

      // DXF background: the placement meta arrives with the layout; the raw
      // drawing is fetched apart (kept light) and parsed for rendering.
      if (d.dxf) {
        dxfMetaRef.current = d.dxf;
        setDxf(d.dxf);
        dxfModelRef.current = null;
        try {
          const rd = await apiFetch(`${API_BASE}/line-engineering/layout/dxf?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`);
          if (rd.ok) {
            const raw = (await rd.json()) as { name: string; data: string } | null;
            dxfModelRef.current = raw?.data ? parseDxf(raw.data) : null;
          }
        } catch { /* the background is optional — ignore */ }
      } else {
        dxfMetaRef.current = null;
        dxfModelRef.current = null;
        setDxf(null);
      }
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
    // Persist edited annotation text.
    c.on('text:editing:exited', (e) => {
      const o = e.target as any;
      if (!o?.annId || o.annType !== 'text') return;
      const a = annotationsRef.current.find((x) => x.id === o.annId);
      if (a) { a.text = (o.text || '').slice(0, 240); setDirty(true); }
    });

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
      if (measureRef.current) { measureClickRef.current(c.getScenePoint(opt.e)); return; }
      if (annToolRef.current) { annClickRef.current(c.getScenePoint(opt.e), (opt as any).target); return; }
      if (linkRef.current) { linkClickRef.current((opt as any).target); return; }
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
    const assetIds = objs.map((o) => (o as any).assetId as string).filter(Boolean);
    const annIds = objs.map((o) => (o as any).annId as string).filter(Boolean);
    if (ids.length === 0 && assetIds.length === 0 && annIds.length === 0) return;
    c.discardActiveObject();
    if (assetIds.length) assetsRef.current = assetsRef.current.filter((a) => !assetIds.includes(a.id));
    if (annIds.length) { annotationsRef.current = annotationsRef.current.filter((a) => !annIds.includes(a.id)); setAnnCount(annotationsRef.current.length); }
    if (ids.length) {
      setPlacedIds((prev) => { const n = new Set(prev); ids.forEach((id) => { n.delete(id); placementsRef.current.delete(id); }); return n; });
    }
    markDirty();
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild]);

  // Drop a new equipment asset at the centre of the current viewport.
  const addAsset = useCallback((kind: string) => {
    const c = fcRef.current; if (!c) return;
    const meta = ASSET_META(kind);
    const center = c.getVpCenter();
    const x = Math.max(0, Math.round(pxToWorld(center.x) - meta.w / 2));
    const y = Math.max(0, Math.round(pxToWorld(center.y) - meta.h / 2));
    const id = `as_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    assetsRef.current = [...assetsRef.current, { id, kind, x, y, w: meta.w, h: meta.h, rotation: 0 }];
    markDirty();
    requestAnimationFrame(() => { rebuild(); const o = objByAssetRef.current.get(id); if (o) { c.setActiveObject(o); c.requestRenderAll(); } });
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

  // ── Measure tool (ephemeral, Fase 6) ────────────────────────────────────────
  const clearMeasure = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    measureObjsRef.current.forEach((o) => c.remove(o));
    measureObjsRef.current = [];
    c.requestRenderAll();
  }, []);

  const handleMeasureClick = useCallback((scenePt: { x: number; y: number }) => {
    const c = fcRef.current; if (!c) return;
    const S = fitRef.current;
    const wpt = { x: scenePt.x / S, y: scenePt.y / S };
    if (!measureP1Ref.current) { measureP1Ref.current = wpt; clearMeasure(); setMeasureVal(null); return; }
    const p1 = measureP1Ref.current, p2 = wpt;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    clearMeasure();
    const u = footprintRef.current.unit;
    const meters = u === 'm' ? dist : dist / 1000;
    const label = `${Math.round(dist)} ${u} · ${meters.toFixed(2)} m`;
    const line = new Line([p1.x * S, p1.y * S, p2.x * S, p2.y * S], { stroke: '#0ea5e9', strokeWidth: 1.5, strokeDashArray: [5, 4], selectable: false, evented: false, strokeUniform: true });
    const mid = new Textbox(label, { left: ((p1.x + p2.x) / 2) * S - 60, top: ((p1.y + p2.y) / 2) * S - 18, width: 120, fontSize: 12, fill: '#0ea5e9', textAlign: 'center', selectable: false, evented: false, backgroundColor: 'rgba(255,255,255,0.85)' });
    measureObjsRef.current.push(line, mid); c.add(line); c.add(mid); c.requestRenderAll();
    setMeasureVal(label);
    measureP1Ref.current = null; // next click starts a fresh measure
  }, [clearMeasure]);
  useEffect(() => { measureClickRef.current = handleMeasureClick; }, [handleMeasureClick]);
  useEffect(() => {
    measureRef.current = measureMode;
    measureP1Ref.current = null;
    if (!measureMode) { clearMeasure(); setMeasureVal(null); }
    requestAnimationFrame(() => rebuild()); // refresh box interactivity for the tool
  }, [measureMode, clearMeasure, rebuild]);

  // ── Export / print (Fase 6) ─────────────────────────────────────────────────
  const downloadBlob = (data: Blob | string, filename: string) => {
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportName = (ext: string) => `layout-${model}-${revision}.${ext}`.replace(/[^\w.\-]+/g, '_');

  // Render the whole footprint (not just the current viewport) and run `fn`.
  const withFitted = useCallback(<T,>(fn: () => T): T => {
    const c = fcRef.current!;
    const prev = c.viewportTransform!.slice() as any;
    c.setViewportTransform([1, 0, 0, 1, 70, 36]); // include the ruler labels
    c.renderAll();
    const out = fn();
    c.setViewportTransform(prev);
    c.requestRenderAll();
    return out;
  }, []);

  const exportPNG = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    const data = withFitted(() => c.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: true } as any));
    downloadBlob(data, exportName('png'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withFitted, model, revision]);

  const exportSVG = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    const svg = c.toSVG();
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), exportName('svg'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, revision]);

  const exportPDF = useCallback(async () => {
    const c = fcRef.current; if (!c) return;
    setExporting(true);
    try {
      const data = withFitted(() => c.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: true } as any));
      const { jsPDF } = await import('jspdf');
      const w = c.getWidth(), h = c.getHeight();
      const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'pt', format: [w, h] });
      pdf.addImage(data, 'PNG', 0, 0, w, h);
      pdf.save(exportName('pdf'));
    } catch { toast.error('No se pudo exportar el PDF.', 'Ing. Industrial'); }
    finally { setExporting(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withFitted, model, revision, toast]);

  const printPlan = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    const data = withFitted(() => c.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: true } as any));
    const w = window.open('', '_blank');
    if (!w) { toast.error('Permite las ventanas emergentes para imprimir.', 'Ing. Industrial'); return; }
    w.document.write(`<html><head><title>Layout ${model} ${revision}</title></head><body style="margin:0"><img src="${data}" style="width:100%" onload="setTimeout(()=>{window.print();},150)"/></body></html>`);
    w.document.close();
  }, [withFitted, model, revision, toast]);

  // ── Footprint config edits ──────────────────────────────────────────────────
  const updateFootprint = (patch: Partial<Footprint>) => {
    const next = { ...footprintRef.current, ...patch };
    footprintRef.current = next; setFootprint(next); markDirty();
    requestAnimationFrame(() => { fitRef.current = computeFit(); rebuild(); });
  };

  // ── DXF background controls ─────────────────────────────────────────────────
  const updateDxf = (patch: Partial<DxfMeta>, geometry: boolean) => {
    const cur = dxfMetaRef.current; if (!cur) return;
    const next = { ...cur, ...patch };
    dxfMetaRef.current = next; setDxf(next); markDirty();
    // Opacity is a cheap in-place prop; geometry (scale/offset/rotation) and
    // toggling visibility on require a redraw.
    if (geometry || patch.visible !== undefined || !dxfGroupRef.current) {
      requestAnimationFrame(() => rebuild());
      return;
    }
    dxfGroupRef.current.set({ opacity: Math.min(1, Math.max(0, next.opacity)) });
    fcRef.current?.requestRenderAll();
  };

  const onDxfFile = useCallback(async (file: File) => {
    setDxfBusy(true);
    try {
      const text = await file.text();
      if (text.length > 12_000_000) { toast.error('El DXF supera 12 MB.', 'Ing. Industrial'); return; }
      const dxfModel = parseDxf(text);
      if (!dxfModel) { toast.error('No se reconocieron líneas en el DXF.', 'Ing. Industrial'); return; }
      const res = await apiFetch(`${API_BASE}/line-engineering/layout/dxf`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, revision, name: file.name, data: text }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e?.message || 'No se pudo guardar el DXF.', 'Ing. Industrial'); return; }
      // Auto-fit the drawing to the footprint (centred); mark dirty so the
      // placement persists on the next Save.
      const fp = footprintRef.current;
      const scale = Math.min(fp.footprintW / dxfModel.width, fp.footprintH / dxfModel.height) * 0.9 || 1;
      const meta: DxfMeta = {
        name: file.name, scale, rotation: 0, visible: true, opacity: 0.5,
        offsetX: Math.max(0, (fp.footprintW - dxfModel.width * scale) / 2),
        offsetY: Math.max(0, (fp.footprintH - dxfModel.height * scale) / 2),
      };
      dxfModelRef.current = dxfModel; dxfMetaRef.current = meta; setDxf(meta); markDirty();
      requestAnimationFrame(() => rebuild());
      toast.success('Plano DXF cargado de fondo.', 'Ing. Industrial');
    } catch { toast.error('No se pudo leer el archivo DXF.', 'Ing. Industrial'); }
    finally { setDxfBusy(false); }
  }, [model, revision, markDirty, rebuild, toast]);

  const removeDxf = useCallback(async () => {
    setDxfBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/line-engineering/layout/dxf?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo quitar el DXF.', 'Ing. Industrial'); return; }
      dxfModelRef.current = null; dxfMetaRef.current = null; setDxf(null);
      requestAnimationFrame(() => rebuild());
      toast.success('Plano DXF quitado.', 'Ing. Industrial');
    } catch { toast.error('Error de red.', 'Ing. Industrial'); }
    finally { setDxfBusy(false); }
  }, [model, revision, rebuild, toast]);

  // ── Station overlays: live MES (Fase 3) + cycle-time heatmap (Fase 9) ────────
  const applyOverlay = useCallback(() => {
    const c = fcRef.current; if (!c) return;
    objByIdRef.current.forEach((box) => {
      const s = stationsRef.current.find((x) => x.id === (box as any).stationId);
      const col = overlayFor((box as any).stationName);
      box.set({
        fill: col ? col.fill : (s?.ctq ? 'rgba(245,158,11,0.16)' : 'rgba(244,63,94,0.12)'),
        stroke: col ? col.stroke : (s?.ctq ? AMBER : ROSE),
        strokeWidth: col ? 2 : 1.5,
      });
    });
    c.requestRenderAll();
  }, [overlayFor]);

  useEffect(() => { mesOnRef.current = mesOn; applyOverlay(); }, [mesOn, applyOverlay]);
  useEffect(() => { heatOnRef.current = heatOn; applyOverlay(); }, [heatOn, applyOverlay]);

  // Poll the live status every 5s while the MES overlay is on.
  useEffect(() => {
    if (!mesOn || !model) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/status?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`);
        if (!r.ok || !alive) return;
        const d = (await r.json()) as StatusSummary;
        statusRef.current = new Map(d.stations.map((s) => [s.station, s]));
        setMesData(d);
        applyOverlay();
      } catch { /* transient — keep polling */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [mesOn, model, revision, applyOverlay]);

  // Fetch the cycle-time heatmap when toggled or when the (optional) takt
  // changes. It's design-time engineering data — fetch once, no polling.
  useEffect(() => {
    if (!heatOn || !model) return;
    let alive = true;
    (async () => {
      try {
        const takt = Number(taktInput);
        const q = takt > 0 ? `&taktTargetSec=${takt}` : '';
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/heatmap?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}${q}`);
        if (!r.ok || !alive) return;
        const d = (await r.json()) as HeatSummary;
        heatRef.current = new Map(d.stations.map((s) => [s.station, s]));
        setHeatData(d);
        applyOverlay();
      } catch { /* transient */ }
    })();
    return () => { alive = false; };
  }, [heatOn, model, revision, taktInput, applyOverlay]);

  // ── Material-flow analysis overlay (Fase 10) ────────────────────────────────
  // Per-segment distances/colors are drawn live by drawConnectors; here we just
  // restyle on toggle and pull the authoritative summary (totals + crossings).
  useEffect(() => { flowOnRef.current = flowOn; drawConnRef.current(); }, [flowOn]);
  useEffect(() => {
    if (!flowOn || !model) return;
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/flow?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`);
        if (!r.ok || !alive) return;
        const d = (await r.json()) as FlowSummary;
        setFlowData(d);
      } catch { /* transient */ }
    })();
    return () => { alive = false; };
  }, [flowOn, model, revision, connCount]);

  // ── Flow connector controls (Fase 4) ───────────────────────────────────────
  const highlightSource = useCallback((id: string | null) => {
    const c = fcRef.current; if (!c) return;
    objByIdRef.current.forEach((box) => {
      if (id && (box as any).stationId === id) box.set({ stroke: '#7c3aed', strokeWidth: 3 });
    });
    c.requestRenderAll();
  }, []);

  const handleLinkTarget = useCallback((target: any) => {
    // Click an existing arrow → delete that connector.
    if (target && target.connIdx !== undefined) {
      connectorsRef.current = connectorsRef.current.filter((_, i) => i !== target.connIdx);
      setConnCount(connectorsRef.current.length); markDirty();
      requestAnimationFrame(() => rebuild());
      return;
    }
    const id = target && (target.stationId as string);
    if (!id) { linkSourceRef.current = null; return; }
    if (!linkSourceRef.current) { linkSourceRef.current = id; highlightSource(id); return; }
    if (linkSourceRef.current === id) { linkSourceRef.current = null; requestAnimationFrame(() => rebuild()); return; }
    const from = linkSourceRef.current, to = id;
    if (!connectorsRef.current.some((c) => c.from === from && c.to === to)) {
      connectorsRef.current = [...connectorsRef.current, { from, to, kind: 'flow' }];
      setConnCount(connectorsRef.current.length); markDirty();
    }
    linkSourceRef.current = null;
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild, highlightSource]);
  useEffect(() => { linkClickRef.current = handleLinkTarget; }, [handleLinkTarget]);

  // Toggling link mode rebuilds so boxes/arrows pick up the right interactivity.
  useEffect(() => { linkRef.current = linkMode; linkSourceRef.current = null; requestAnimationFrame(() => rebuild()); }, [linkMode, rebuild]);

  // Auto-connect placed stations following their routing sequence.
  const autoConnect = useCallback(() => {
    const placedSeq = stationsRef.current
      .filter((s) => placementsRef.current.has(s.id))
      .sort((a, b) => a.sequence - b.sequence);
    const links: LayoutConnector[] = [];
    for (let i = 0; i + 1 < placedSeq.length; i++) links.push({ from: placedSeq[i].id, to: placedSeq[i + 1].id, kind: 'flow' });
    connectorsRef.current = links;
    setConnCount(links.length); markDirty();
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild]);

  const clearConnectors = useCallback(() => {
    connectorsRef.current = []; setConnCount(0); markDirty();
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild]);

  // ── Annotation interactions (Fase 7) ────────────────────────────────────────
  const handleAnnClick = useCallback((scene: { x: number; y: number }, target: any) => {
    const tool = annToolRef.current;
    const S = fitRef.current;
    const wpt = { x: Math.max(0, Math.round(scene.x / S)), y: Math.max(0, Math.round(scene.y / S)) };
    const nid = () => `an_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    if (tool === 'text') {
      const id = nid();
      annotationsRef.current = [...annotationsRef.current, { id, type: 'text', x: wpt.x, y: wpt.y, text: 'Texto' }];
      setAnnCount(annotationsRef.current.length); markDirty();
      requestAnimationFrame(() => { rebuild(); const o = objByAnnRef.current.get(id); if (o) { fcRef.current?.setActiveObject(o); fcRef.current?.requestRenderAll(); } });
      return;
    }
    if (tool === 'dim') {
      if (target && target.annId) {
        annotationsRef.current = annotationsRef.current.filter((a) => a.id !== target.annId);
        setAnnCount(annotationsRef.current.length); markDirty();
        requestAnimationFrame(() => rebuild());
        return;
      }
      if (!annDimP1Ref.current) { annDimP1Ref.current = wpt; return; }
      const p1 = annDimP1Ref.current; annDimP1Ref.current = null;
      annotationsRef.current = [...annotationsRef.current, { id: nid(), type: 'dim', x: p1.x, y: p1.y, x2: wpt.x, y2: wpt.y }];
      setAnnCount(annotationsRef.current.length); markDirty();
      requestAnimationFrame(() => rebuild());
    }
  }, [markDirty, rebuild]);
  useEffect(() => { annClickRef.current = handleAnnClick; }, [handleAnnClick]);
  useEffect(() => {
    annToolRef.current = annTool;
    annDimP1Ref.current = null;
    requestAnimationFrame(() => rebuild());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annTool]);

  const clearAnnotations = useCallback(() => {
    annotationsRef.current = []; setAnnCount(0); markDirty();
    requestAnimationFrame(() => rebuild());
  }, [markDirty, rebuild]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!model) return;
    setSaving(true);
    try {
      const positions = [...placementsRef.current.entries()].map(([id, p]) => ({ id, ...p }));
      const cleared = [...loadedPlacedRef.current].filter((id) => !placementsRef.current.has(id));
      const m = dxfMetaRef.current;
      const dxfMeta = m
        ? { offsetX: m.offsetX, offsetY: m.offsetY, scale: m.scale, rotation: m.rotation, visible: m.visible, opacity: m.opacity }
        : undefined;
      const r = await apiFetch(`${API_BASE}/line-engineering/layout`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, revision, footprint: footprintRef.current, positions, cleared, connectors: connectorsRef.current, assets: assetsRef.current, annotations: annotationsRef.current, ...(dxfMeta ? { dxf: dxfMeta } : {}) }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d?.message || 'No se pudo guardar.', 'Ing. Industrial'); return; }
      toast.success('Layout guardado.', 'Ing. Industrial');
      loadedPlacedRef.current = new Set(placementsRef.current.keys());
      setDirty(false);
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setSaving(false); }
  }, [model, revision, toast]);

  // ── Clone / template (Fase 8) ───────────────────────────────────────────────
  const cloneFrom = useCallback(async () => {
    if (!cloneSrc || !model) return;
    const [fromModel, fromRevision] = cloneSrc.split('|');
    setCloneBusy(true);
    try {
      const r = await apiFetch(`${API_BASE}/line-engineering/layout/clone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromModel, fromRevision, toModel: model, toRevision: revision }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d?.message || 'No se pudo clonar.', 'Ing. Industrial'); return; }
      toast.success('Layout clonado desde la plantilla.', 'Ing. Industrial');
      setShowClone(false);
      load();
    } catch { toast.error('Error de red.', 'Ing. Industrial'); } finally { setCloneBusy(false); }
  }, [cloneSrc, model, revision, load, toast]);

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
        <button onClick={() => { setMesOn((v) => !v); setHeatOn(false); }} title="MES en vivo (estado de estaciones)" className={`p-1.5 rounded-lg transition-colors ${mesOn ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`} style={mesOn ? { background: '#10b981' } : undefined}><Activity className="w-4 h-4" /></button>
        <button onClick={() => { setHeatOn((v) => !v); setMesOn(false); }} title="Mapa de calor (tiempo de ciclo / utilización)" className={`p-1.5 rounded-lg transition-colors ${heatOn ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`} style={heatOn ? { background: '#f97316' } : undefined}><Flame className="w-4 h-4" /></button>
        <button onClick={() => setFlowOn((v) => !v)} title="Diagrama de flujo (distancias y cruces)" className={`p-1.5 rounded-lg transition-colors ${flowOn ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`} style={flowOn ? { background: '#3b82f6' } : undefined}><Waypoints className="w-4 h-4" /></button>
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
        <Sep />
        <button onClick={() => setMeasureMode((v) => !v)} title="Medir distancia" className={`p-1.5 rounded-lg transition-colors ${measureMode ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`} style={measureMode ? { background: '#0ea5e9' } : undefined}><Ruler className="w-4 h-4" /></button>
        <TBtn onClick={exportPNG} title="Exportar PNG"><Download className="w-4 h-4" /></TBtn>
        <TBtn onClick={exportSVG} title="Exportar SVG"><Workflow className="w-4 h-4" /></TBtn>
        <TBtn onClick={exportPDF} title="Exportar PDF">{exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-[11px] font-bold leading-none">PDF</span>}</TBtn>
        <TBtn onClick={printPlan} title="Imprimir"><Printer className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn onClick={() => { setCloneSrc(''); setShowClone(true); }} title="Plantilla: clonar desde otro modelo"><CopyPlus className="w-4 h-4" /></TBtn>
        <div className="flex-1" />
        {measureMode && measureVal && <span className="text-[12px] font-medium mr-2" style={{ color: '#0ea5e9' }}>{measureVal}</span>}
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

      {/* DXF background (Fase 2) — read-only client/plant floor plan */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] text-gray-500 flex-wrap">
        <span className="font-medium inline-flex items-center gap-1"><MapIcon className="w-3.5 h-3.5" /> Plano DXF:</span>
        {!dxf ? (
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 hover:bg-black/[0.07] dark:hover:bg-white/[0.1]">
            {dxfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Cargar de fondo
            <input type="file" accept=".dxf" className="hidden" disabled={dxfBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onDxfFile(f); e.currentTarget.value = ''; }} />
          </label>
        ) : (
          <>
            <span className="truncate max-w-[150px] font-medium text-gray-600 dark:text-gray-300" title={dxf.name}>{dxf.name}</span>
            <button onClick={() => updateDxf({ visible: !dxf.visible }, false)} title={dxf.visible ? 'Ocultar' : 'Mostrar'} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">{dxf.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
            <label className="flex items-center gap-1">Opacidad<input type="range" min={0} max={1} step={0.05} value={dxf.opacity} onChange={(e) => updateDxf({ opacity: Number(e.target.value) }, false)} className="w-16 accent-rose-500" /></label>
            <label className="flex items-center gap-1">Escala<input type="number" step="0.01" min={0.0001} value={dxf.scale} onChange={(e) => updateDxf({ scale: Math.max(0.0001, Number(e.target.value) || 1) }, true)} className="w-16 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
            <label className="flex items-center gap-1">Rot°<input type="number" value={dxf.rotation} onChange={(e) => updateDxf({ rotation: Number(e.target.value) || 0 }, true)} className="w-14 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
            <label className="flex items-center gap-1">ΔX<input type="number" value={Math.round(dxf.offsetX)} onChange={(e) => updateDxf({ offsetX: Number(e.target.value) || 0 }, true)} className="w-16 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
            <label className="flex items-center gap-1">ΔY<input type="number" value={Math.round(dxf.offsetY)} onChange={(e) => updateDxf({ offsetY: Number(e.target.value) || 0 }, true)} className="w-16 rounded-md px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 tabular-nums" /></label>
            <button onClick={removeDxf} disabled={dxfBusy} title="Quitar plano" className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">{dxfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
          </>
        )}
      </div>

      {/* Flow connectors (Fase 4) */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] text-gray-500 flex-wrap">
        <span className="font-medium inline-flex items-center gap-1"><Workflow className="w-3.5 h-3.5" /> Flujo:</span>
        <button onClick={() => setLinkMode((v) => !v)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${linkMode ? 'text-white border-transparent' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'}`} style={linkMode ? { background: '#3b82f6' } : undefined}>
          <Workflow className="w-3.5 h-3.5" /> {linkMode ? 'Conectando… (clic origen → destino)' : 'Conectar estaciones'}
        </button>
        <button onClick={autoConnect} title="Conectar según la secuencia de ruteo" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"><Wand2 className="w-3.5 h-3.5" /> Auto secuencia</button>
        <button onClick={clearConnectors} disabled={connCount === 0} title="Quitar todas las conexiones" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-gray-400 hover:text-rose-500 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Limpiar</button>
        <span className="text-gray-400">· {connCount} {connCount === 1 ? 'conexión' : 'conexiones'}{linkMode ? ' · clic en una flecha para borrarla' : ''}</span>
      </div>

      {/* Equipment palette (Fase 5) */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] text-gray-500 flex-wrap">
        <span className="font-medium inline-flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Equipos:</span>
        {ASSET_KINDS.map((k) => (
          <button key={k.kind} onClick={() => addAsset(k.kind)} title={`Agregar ${k.label}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: k.color }} /> {k.label}
          </button>
        ))}
      </div>

      {/* Annotations: text + dimensions (Fase 7) */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] text-gray-500 flex-wrap">
        <span className="font-medium inline-flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Notas:</span>
        <button onClick={() => setAnnTool((t) => (t === 'text' ? null : 'text'))} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${annTool === 'text' ? 'text-white border-transparent' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'}`} style={annTool === 'text' ? { background: '#0f172a' } : undefined}><Type className="w-3.5 h-3.5" /> Texto</button>
        <button onClick={() => setAnnTool((t) => (t === 'dim' ? null : 'dim'))} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${annTool === 'dim' ? 'text-white border-transparent' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'}`} style={annTool === 'dim' ? { background: '#0ea5e9' } : undefined}><MoveHorizontal className="w-3.5 h-3.5" /> Cota</button>
        <button onClick={clearAnnotations} disabled={annCount === 0} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-gray-400 hover:text-rose-500 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Limpiar</button>
        <span className="text-gray-400">· {annCount} {annCount === 1 ? 'nota' : 'notas'}{annTool === 'text' ? ' · clic para colocar (doble clic edita)' : annTool === 'dim' ? ' · clic en 2 puntos; clic en una cota la borra' : ''}</span>
      </div>

      {mesOn && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: '#10b981' }}>
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#10b981' }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#10b981' }} /></span>
            MES en vivo
          </span>
          <LegendDot color="#10b981" label={`OK ${mesData?.counts.ok ?? 0}`} />
          <LegendDot color="#f59e0b" label={`Aviso ${mesData?.counts.warn ?? 0}`} />
          <LegendDot color="#ef4444" label={`Paro ${mesData?.counts.down ?? 0}`} />
          <LegendDot color="#94a3b8" label={`Inactivo ${mesData?.counts.idle ?? 0}`} />
          <span className="text-gray-400 ml-auto">{mesData ? `actualizado ${new Date(mesData.updatedAt).toLocaleTimeString()}` : 'cargando…'}</span>
        </div>
      )}

      {heatOn && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: '#f97316' }}>
            <Flame className="w-3.5 h-3.5" /> Calor
          </span>
          <label className="inline-flex items-center gap-1 text-gray-500" title="Takt objetivo: con valor se colorea por utilización; vacío, por carga relativa al cuello de botella.">
            takt
            <input type="number" min={0} value={taktInput} onChange={(e) => setTaktInput(e.target.value)} placeholder="auto" className="w-16 px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 bg-transparent text-[12px]" />
            s
          </label>
          {(['cold', 'cool', 'warm', 'hot', 'over'] as HeatLevel[]).map((lv) => (
            <LegendDot key={lv} color={HEAT_COLORS[lv].stroke} label={HEAT_LABEL[lv]} />
          ))}
          <span className="text-gray-500 ml-auto">
            {heatData
              ? `Cuello: ${heatData.bottleneckStation ?? '—'} · ciclo ${heatData.lineCycleTimeSec}s · balance ${Math.round(heatData.balancePct * 100)}%${heatData.taktSec > 0 ? ` · takt ${heatData.taktSec}s` : ' · sin takt (carga relativa)'}`
              : 'cargando…'}
          </span>
        </div>
      )}

      {flowOn && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-black/5 dark:border-white/10 text-[12px] flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: '#3b82f6' }}>
            <Waypoints className="w-3.5 h-3.5" /> Flujo
          </span>
          <LegendDot color="#10b981" label="Corto" />
          <LegendDot color="#f59e0b" label="Medio" />
          <LegendDot color="#ef4444" label="Largo" />
          <span className="text-gray-500 ml-auto inline-flex items-center gap-3">
            {flowData ? (
              <>
                <span>Recorrido total <b>{Math.round(flowData.totalDistance)} {flowData.unit}</b></span>
                <span>· tramo más largo {Math.round(flowData.longestSegment?.distance ?? 0)} {flowData.unit}</span>
                <span className={flowData.crossings > 0 ? 'text-rose-500 font-medium' : ''}>· cruces {flowData.crossings}</span>
                {flowData.unplacedLinks > 0 && <span className="text-amber-500">· {flowData.unplacedLinks} sin colocar</span>}
              </>
            ) : 'cargando…'}
          </span>
        </div>
      )}

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

      {/* Clone / template modal (Fase 8) */}
      {showClone && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowClone(false)}>
          <div className={`${glass} rounded-2xl p-5 w-full max-w-md`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold inline-flex items-center gap-2"><CopyPlus className="w-4 h-4" style={{ color: ROSE }} /> Clonar layout desde plantilla</h3>
              <button onClick={() => setShowClone(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] text-gray-400 mb-3">Copia footprint, plano DXF, equipos y notas. Las posiciones y el flujo se reasignan por nombre de estación (revisiones del mismo modelo se copian completas).</p>
            <label className="block text-[12px] font-medium text-gray-500 mb-1">Modelo origen</label>
            <select value={cloneSrc} onChange={(e) => setCloneSrc(e.target.value)} className="w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm">
              <option value="">Selecciona…</option>
              {models.filter((m) => !(m.model === model && m.revision === revision)).map((m) => (
                <option key={`${m.model}|${m.revision}`} value={`${m.model}|${m.revision}`}>{m.model} · {m.revision}</option>
              ))}
            </select>
            <div className="mt-3 text-[12px] text-gray-400">Destino: <span className="font-medium text-gray-600 dark:text-gray-300">{model} · {revision}</span></div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowClone(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={cloneFrom} disabled={!cloneSrc || cloneBusy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: ROSE }}>
                {cloneBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CopyPlus className="w-4 h-4" />} Clonar aquí
              </button>
            </div>
          </div>
        </div>
      )}
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
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}
