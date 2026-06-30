'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2, X, Box, Download, BarChart3 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * 3D view of the 2D layout (Fase 30 + pulido Fase 31). Extrudes each placed
 * station into a labelled block over the footprint floor, draws the flow
 * connectors as arched tubes, and can scale/colour the blocks by cycle time
 * (a 3D Yamazumi). Orbit / zoom / pan with three.js + OrbitControls, export to
 * PNG. Read-only; three.js is lazy-loaded so it only ships when opened.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const VIEW_H = 460;
const LEVEL_HEX: Record<string, number> = {
  cold: 0x3b82f6, cool: 0x06b6d4, warm: 0xf59e0b, hot: 0xf97316, over: 0xef4444,
};

interface St {
  id: string; station: string; ctq: boolean;
  x: number | null; y: number | null; w: number | null; h: number | null; rotation: number | null;
}
interface Cell { id: string; name: string; color: string; stationIds: string[] }
interface Conn { from: string; to: string; kind?: string }
interface Layout {
  footprint: { footprintW: number; footprintH: number; unit: string; gridSize: number };
  stations: St[];
  cells?: Cell[];
  connectors?: Conn[];
}
type HeatMap = Record<string, { cycle: number; level: string }>;

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const fontSize = 44;
  const measure = canvas.getContext('2d')!;
  measure.font = `bold ${fontSize}px sans-serif`;
  const tw = measure.measureText(text).width;
  canvas.width = Math.ceil(tw + 28);
  canvas.height = fontSize + 22;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(1.5 * aspect, 1.5, 1);
  return sprite;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const mesh = c as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        const mm = m as THREE.Material & { map?: THREE.Texture | null };
        if (mm.map) mm.map.dispose();
        m.dispose();
      });
    }
  });
}

export default function Layout3D({
  model,
  revision,
  open,
  onClose,
}: {
  model: string;
  revision: string;
  open: boolean;
  onClose: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Layout | null>(null);
  const [heat, setHeat] = useState<HeatMap | null>(null);
  const [byCycle, setByCycle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const ctxRef = useRef<{ s: number; W: number; H: number; toScene: (x: number, y: number) => { x: number; z: number } } | null>(null);
  const populateRef = useRef<() => void>(() => {});

  // Fetch layout + heatmap when opened.
  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setData(null);
      setHeat(null);
      setError(null);
    });
    (async () => {
      try {
        const [rl, rh] = await Promise.all([
          apiFetch(`${API_BASE}/line-engineering/layout?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`),
          apiFetch(`${API_BASE}/line-engineering/layout/heatmap?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`),
        ]);
        if (!alive) return;
        if (!rl.ok) { setError('No se pudo cargar el layout.'); return; }
        setData((await rl.json()) as Layout);
        if (rh.ok) {
          const hd = (await rh.json()) as { stations: { station: string; cycleTimeSec: number; level: string }[] };
          const map: HeatMap = {};
          hd.stations.forEach((s) => { map[s.station] = { cycle: s.cycleTimeSec, level: s.level }; });
          setHeat(map);
        }
      } catch {
        if (alive) setError('No se pudo cargar el layout.');
      }
    })();
    return () => { alive = false; };
  }, [open, model, revision]);

  // Latest populate() — rebuilds only the content group (keeps the camera).
  const populate = () => {
    const scene = sceneRef.current;
    const content = contentRef.current;
    const ctx = ctxRef.current;
    if (!scene || !content || !ctx || !data) return;
    while (content.children.length) {
      const o = content.children[content.children.length - 1];
      content.remove(o);
      disposeObject(o);
    }
    const { s, W, H, toScene } = ctx;
    const placed = data.stations.filter((st) => st.x !== null && st.y !== null);
    const maxCycle = heat ? Math.max(1, ...placed.map((st) => heat[st.station]?.cycle ?? 0)) : 1;
    const tops = new Map<string, { x: number; y: number; z: number }>();

    // Cell floor tints.
    (data.cells ?? []).forEach((c) => {
      const members = placed.filter((st) => c.stationIds.includes(st.id));
      if (members.length === 0) return;
      const pad = ctx.W * 0 + (data.footprint.gridSize || 0);
      const x0 = Math.min(...members.map((m) => m.x as number)) - pad;
      const y0 = Math.min(...members.map((m) => m.y as number)) - pad;
      const x1 = Math.max(...members.map((m) => (m.x as number) + (m.w ?? W * 0.06))) + pad;
      const y1 = Math.max(...members.map((m) => (m.y as number) + (m.h ?? H * 0.08))) + pad;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry((x1 - x0) * s, (y1 - y0) * s),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color), transparent: true, opacity: 0.2 }),
      );
      plane.rotation.x = -Math.PI / 2;
      const ctr = toScene((x0 + x1) / 2, (y0 + y1) / 2);
      plane.position.set(ctr.x, 0.03, ctr.z);
      content.add(plane);
    });

    // Blocks + labels.
    placed.forEach((st) => {
      const w = st.w ?? W * 0.06;
      const h = st.h ?? H * 0.08;
      let hgt = Math.max(0.6, Math.min(w * s, h * s) * 0.7);
      let color = st.ctq ? 0xf59e0b : 0xf43f5e;
      if (byCycle && heat) {
        const cyc = heat[st.station]?.cycle ?? 0;
        hgt = 0.4 + (cyc / maxCycle) * 6;
        color = LEVEL_HEX[heat[st.station]?.level ?? 'cold'] ?? 0x3b82f6;
      }
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w * s, hgt, h * s),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 }),
      );
      const ctr = toScene((st.x as number) + w / 2, (st.y as number) + h / 2);
      mesh.position.set(ctr.x, hgt / 2, ctr.z);
      mesh.rotation.y = -((st.rotation ?? 0) * Math.PI) / 180;
      content.add(mesh);
      tops.set(st.id, { x: ctr.x, y: hgt, z: ctr.z });
      const label = makeLabel(st.station);
      label.position.set(ctr.x, hgt + 1.0, ctr.z);
      content.add(label);
    });

    // Flow connectors as arched tubes between block tops.
    (data.connectors ?? []).forEach((cn) => {
      const a = tops.get(cn.from);
      const b = tops.get(cn.to);
      if (!a || !b) return;
      const start = new THREE.Vector3(a.x, a.y + 0.15, a.z);
      const end = new THREE.Vector3(b.x, b.y + 0.15, b.z);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += start.distanceTo(end) * 0.22 + 0.8;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const color = cn.kind === 'conveyor' ? 0x7c3aed : cn.kind === 'return' ? 0x94a3b8 : 0x3b82f6;
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.1, 7, false),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
      );
      content.add(tube);
    });
  };

  useEffect(() => { populateRef.current = populate; });

  // Build renderer / scene / camera once per open+data; re-render on toggle.
  useEffect(() => {
    const mount = mountRef.current;
    if (!open || !data || !mount) return;
    let raf = 0;
    let disposed = false;
    const width = mount.clientWidth || 720;
    const fp = data.footprint;
    const W = fp.footprintW || 1;
    const H = fp.footprintH || 1;
    const s = 24 / Math.max(W, H);
    const toScene = (wx: number, wy: number) => ({ x: (wx - W / 2) * s, z: (wy - H / 2) * s });
    ctxRef.current = { s, W, H, toScene };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(50, width / VIEW_H, 0.1, 3000);
    camera.position.set(W * s * 0.5, Math.max(W, H) * s * 0.75, H * s * 0.95 + 8);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, VIEW_H);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(W * s, Math.max(W, H) * s, H * s);
    scene.add(dir);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W * s, H * s),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(Math.max(W * s, H * s), 24, 0x334155, 0x223047);
    scene.add(grid);

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;
    populateRef.current();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    controls.update();

    const onResize = () => {
      const w = mount.clientWidth || width;
      renderer.setSize(w, VIEW_H);
      camera.aspect = w / VIEW_H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      if (contentRef.current) disposeObject(contentRef.current);
      disposeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
      contentRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
    };
  }, [open, data]);

  // Rebuild just the content (blocks/labels/tubes) when the toggle / heat changes.
  useEffect(() => {
    if (open && data && sceneRef.current) populateRef.current();
  }, [byCycle, heat, open, data]);

  const exportPng = () => {
    const r = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!r || !scene || !camera) return;
    r.render(scene, camera);
    const url = r.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout3d-${model}-${revision}.png`.replace(/[^\w.\-]+/g, '_');
    a.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-4 w-full max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2"><Box className="w-4 h-4" style={{ color: '#f43f5e' }} /> Vista 3D · {model} · {revision}</h3>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setByCycle((v) => !v)} disabled={!heat} title="Altura y color por tiempo de ciclo (Yamazumi 3D)" className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 ${byCycle ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`} style={byCycle ? { background: '#f97316' } : undefined}><BarChart3 className="w-3.5 h-3.5" /> por ciclo</button>
            <button onClick={exportPng} title="Exportar PNG" className="p-1.5 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"><Download className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {error ? (
          <p className="text-[12px] text-amber-500 py-16 text-center">{error}</p>
        ) : !data ? (
          <div className="grid place-items-center text-gray-500 dark:text-gray-400" style={{ height: VIEW_H }}><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div ref={mountRef} className="rounded-xl overflow-hidden" style={{ width: '100%', height: VIEW_H }} />
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Arrastra para rotar · rueda para zoom · clic derecho para desplazar. Bloques = estaciones, tubos = flujo, tintes de piso = celdas{heat ? '. «por ciclo»: altura y color por tiempo de ciclo.' : '.'}</p>
      </div>
    </div>
  );
}
