'use client';

import React from 'react';
import { POLY_SHAPES, PATH_SHAPES, SHAPE_LIBRARY } from './shapes';

/** Vista previa SVG de una forma de la biblioteca (polígono o path). */
function ShapePreview({ kind }: { kind: string }) {
  if (POLY_SHAPES[kind]) {
    const pts = POLY_SHAPES[kind].map((p) => `${p.x},${p.y}`).join(' ');
    return (
      <svg viewBox="-6 -6 112 112" className="w-6 h-6">
        <polygon points={pts} className="fill-gray-500 dark:fill-gray-300" />
      </svg>
    );
  }
  const def = PATH_SHAPES[kind];
  if (!def) return null;
  return (
    <svg viewBox={`-6 -6 ${def.w + 12} ${def.h + 12}`} className="w-6 h-6">
      <path d={def.d} className="fill-gray-500 dark:fill-gray-300" />
    </svg>
  );
}

/** Galería de formas agrupada por categoría, para el popover del ribbon. */
export function ShapeGallery({ onPick }: { onPick: (kind: string) => void }) {
  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
      {SHAPE_LIBRARY.map((cat) => (
        <div key={cat.label}>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-500 px-1 mb-1">{cat.label}</p>
          <div className="grid grid-cols-6 gap-1">
            {cat.shapes.map((s) => (
              <button
                key={s.kind} type="button" title={s.label}
                onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(s.kind)}
                className="h-9 inline-flex items-center justify-center rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10"
              >
                <ShapePreview kind={s.kind} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
