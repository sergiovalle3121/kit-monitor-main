'use client';

import React, { useEffect, useState } from 'react';
import type { Canvas, TMat2D } from 'fabric';

/**
 * Overview minimap for the 2D layout editor (Fase 20). Renders the footprint,
 * the placed stations and the current viewport rectangle, and lets the engineer
 * click to recenter the main canvas. Kept as its own component so its frequent
 * (throttled) refreshes don't re-render the heavy editor — it reads the editor's
 * refs inside a polling effect and snapshots a small view-model into state, so
 * render never touches refs directly.
 */

interface Placement { x: number; y: number; w: number; h: number; rotation: number }
interface Footprint { footprintW: number; footprintH: number; unit: string; gridSize: number }
interface MiniBox { x: number; y: number; w: number; h: number }
interface MiniSnap {
  contentW: number;
  contentH: number;
  miniScale: number;
  stations: MiniBox[];
  view: MiniBox;
}

const MINI_W = 168;
const MINI_H = 118;

export default function Minimap({
  canvasRef,
  fitRef,
  placementsRef,
  footprintRef,
}: {
  canvasRef: React.MutableRefObject<Canvas | null>;
  fitRef: React.MutableRefObject<number>;
  placementsRef: React.MutableRefObject<Map<string, Placement>>;
  footprintRef: React.MutableRefObject<Footprint>;
}) {
  const [snap, setSnap] = useState<MiniSnap | null>(null);

  // Poll ~12×/s; snapshot a view-model only when something visible changed.
  useEffect(() => {
    let raf = 0;
    let lastT = 0;
    let lastKey = '';
    const tick = (t: number) => {
      if (t - lastT > 80) {
        lastT = t;
        const c = canvasRef.current;
        const fp = footprintRef.current;
        if (c && c.viewportTransform && fp) {
          const fpW = fp.footprintW || 1;
          const fpH = fp.footprintH || 1;
          const miniScale = Math.min(MINI_W / fpW, MINI_H / fpH);
          const vt = c.viewportTransform;
          const zoom = c.getZoom() || 1;
          const fit = fitRef.current || 1;
          const cw = c.getWidth();
          const ch = c.getHeight();
          const wx0 = (0 - vt[4]) / zoom / fit;
          const wy0 = (0 - vt[5]) / zoom / fit;
          const wx1 = (cw - vt[4]) / zoom / fit;
          const wy1 = (ch - vt[5]) / zoom / fit;
          const placements = [...placementsRef.current.values()];
          const sig = `${miniScale.toFixed(4)}|${vt[4].toFixed(1)},${vt[5].toFixed(1)},${zoom.toFixed(3)}|${placements
            .map((p) => `${p.x},${p.y},${p.w},${p.h}`)
            .join(';')}`;
          if (sig !== lastKey) {
            lastKey = sig;
            setSnap({
              contentW: fpW * miniScale,
              contentH: fpH * miniScale,
              miniScale,
              stations: placements.map((p) => ({
                x: p.x * miniScale,
                y: p.y * miniScale,
                w: Math.max(1, p.w * miniScale),
                h: Math.max(1, p.h * miniScale),
              })),
              view: {
                x: wx0 * miniScale,
                y: wy0 * miniScale,
                w: (wx1 - wx0) * miniScale,
                h: (wy1 - wy0) * miniScale,
              },
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, fitRef, placementsRef, footprintRef]);

  const navigate = (e: React.MouseEvent<SVGSVGElement>) => {
    const cc = canvasRef.current;
    if (!cc || !cc.viewportTransform || !snap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = (e.clientX - rect.left) / snap.miniScale;
    const worldY = (e.clientY - rect.top) / snap.miniScale;
    const fit = fitRef.current || 1;
    const zoom = cc.getZoom() || 1;
    const vt = cc.viewportTransform;
    const next: TMat2D = [
      vt[0],
      vt[1],
      vt[2],
      vt[3],
      cc.getWidth() / 2 - worldX * fit * zoom,
      cc.getHeight() / 2 - worldY * fit * zoom,
    ];
    cc.setViewportTransform(next);
  };

  return (
    <div
      className="absolute bottom-3 right-3 z-20 rounded-lg border border-black/10 dark:border-white/15 bg-white/85 dark:bg-black/60 backdrop-blur shadow-sm"
      style={{ width: MINI_W + 8, height: MINI_H + 8, padding: 4 }}
      title="Minimapa — clic para navegar"
    >
      <svg
        width={MINI_W}
        height={MINI_H}
        onMouseDown={navigate}
        style={{ cursor: 'pointer', display: 'block', overflow: 'hidden' }}
      >
        {snap && (
          <>
            <rect x={0} y={0} width={snap.contentW} height={snap.contentH} fill="rgba(148,163,184,0.10)" stroke="rgba(148,163,184,0.5)" />
            {snap.stations.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(244,63,94,0.55)" />
            ))}
            <rect x={snap.view.x} y={snap.view.y} width={snap.view.w} height={snap.view.h} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth={1.2} />
          </>
        )}
      </svg>
    </div>
  );
}
