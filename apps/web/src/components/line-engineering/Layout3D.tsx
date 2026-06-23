'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Loader2, X, Box } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * 3D view of the 2D layout (Fase 30). Extrudes each placed station into a block
 * over the footprint floor and lets the engineer orbit / zoom / pan with
 * three.js + OrbitControls. Read-only visualization, lazy-loaded so three.js is
 * only fetched when the 3D view is opened.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const VIEW_H = 460;

interface St {
  id: string; station: string; ctq: boolean;
  x: number | null; y: number | null; w: number | null; h: number | null; rotation: number | null;
}
interface Cell { id: string; name: string; color: string; stationIds: string[] }
interface Layout {
  footprint: { footprintW: number; footprintH: number; unit: string; gridSize: number };
  stations: St[];
  cells?: Cell[];
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
  const [error, setError] = useState<string | null>(null);

  // Fetch the layout when opened.
  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    setData(null);
    setError(null);
    (async () => {
      try {
        const r = await apiFetch(`${API_BASE}/line-engineering/layout?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo cargar el layout.'); return; }
        setData((await r.json()) as Layout);
      } catch {
        if (alive) setError('No se pudo cargar el layout.');
      }
    })();
    return () => { alive = false; };
  }, [open, model, revision]);

  // Build the three.js scene once the data + mount node are ready.
  useEffect(() => {
    const mount = mountRef.current;
    if (!open || !data || !mount) return;
    let raf = 0;
    let disposed = false;

    const width = mount.clientWidth || 720;
    const fp = data.footprint;
    const W = fp.footprintW || 1;
    const H = fp.footprintH || 1;
    const s = 24 / Math.max(W, H); // world units → scene units
    const toScene = (wx: number, wy: number) => ({ x: (wx - W / 2) * s, z: (wy - H / 2) * s });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    const camera = new THREE.PerspectiveCamera(50, width / VIEW_H, 0.1, 2000);
    camera.position.set(W * s * 0.5, Math.max(W, H) * s * 0.7, H * s * 0.9 + 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, VIEW_H);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(W * s, Math.max(W, H) * s, H * s);
    scene.add(dir);

    const groundW = W * s;
    const groundH = H * s;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundW, groundH),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(Math.max(groundW, groundH), 24, 0x334155, 0x223047);
    scene.add(grid);

    const placed = data.stations.filter((st) => st.x !== null && st.y !== null);
    const disposables: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];

    // Cell floor tints (under the blocks).
    (data.cells ?? []).forEach((c) => {
      const members = placed.filter((st) => c.stationIds.includes(st.id));
      if (members.length === 0) return;
      const pad = fp.gridSize || 0;
      const x0 = Math.min(...members.map((m) => m.x as number)) - pad;
      const y0 = Math.min(...members.map((m) => m.y as number)) - pad;
      const x1 = Math.max(...members.map((m) => (m.x as number) + (m.w ?? W * 0.06))) + pad;
      const y1 = Math.max(...members.map((m) => (m.y as number) + (m.h ?? H * 0.08))) + pad;
      const geo = new THREE.PlaneGeometry((x1 - x0) * s, (y1 - y0) * s);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color), transparent: true, opacity: 0.2 });
      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI / 2;
      const ctr = toScene((x0 + x1) / 2, (y0 + y1) / 2);
      plane.position.set(ctr.x, 0.03, ctr.z);
      scene.add(plane);
      disposables.push({ geometry: geo, material: mat });
    });

    // Extruded station blocks.
    placed.forEach((st) => {
      const w = st.w ?? W * 0.06;
      const h = st.h ?? H * 0.08;
      const hgt = Math.max(0.6, Math.min(w * s, h * s) * 0.7);
      const geo = new THREE.BoxGeometry(w * s, hgt, h * s);
      const mat = new THREE.MeshStandardMaterial({
        color: st.ctq ? 0xf59e0b : 0xf43f5e,
        roughness: 0.5,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const ctr = toScene((st.x as number) + w / 2, (st.y as number) + h / 2);
      mesh.position.set(ctr.x, hgt / 2, ctr.z);
      mesh.rotation.y = -((st.rotation ?? 0) * Math.PI) / 180;
      scene.add(mesh);
      disposables.push({ geometry: geo, material: mat });
    });

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
      disposables.forEach((d) => { d.geometry.dispose(); d.material.dispose(); });
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [open, data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-4 w-full max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2"><Box className="w-4 h-4" style={{ color: '#f43f5e' }} /> Vista 3D · {model} · {revision}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {error ? (
          <p className="text-[12px] text-amber-500 py-16 text-center">{error}</p>
        ) : !data ? (
          <div className="grid place-items-center text-gray-400" style={{ height: VIEW_H }}><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div ref={mountRef} className="rounded-xl overflow-hidden" style={{ width: '100%', height: VIEW_H }} />
        )}
        <p className="text-[11px] text-gray-400 mt-2">Arrastra para rotar · rueda para zoom · clic derecho para desplazar. Cada bloque es una estación; los colores de piso son las celdas.</p>
      </div>
    </div>
  );
}
