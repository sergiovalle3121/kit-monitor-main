'use client';

/** Árbol AS-BUILT de una serie: qué lote/reel de cada NP se consumió, con
 *  operador · estación · hora · fuente. Cuna-a-tumba para una unidad. */

import { useState } from 'react';
import {
  Boxes,
  ChevronRight,
  Clock,
  Cpu,
  Factory,
  GitBranch,
  MapPin,
  Network,
  TriangleAlert,
  User,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import type { AsBuiltComponent, AsBuiltTree } from '../_lib/types';
import { fmtDateTime, fmtQty, fmtRelative, sourceMeta } from '../_lib/format';
import { Badge, EmptyState, Kpi } from './primitives';

const PROD = '#ff7a45'; // acento producción (mismo del header)

export function AsBuiltView({ tree }: { tree: AsBuiltTree }) {
  if (!tree.parts.length) {
    return (
      <EmptyState
        icon={Network}
        title={`Sin genealogía capturada para ${tree.serial}`}
        body="No hay consumos ligados a esta serie todavía. Aparecerán cuando el operador confirme producción con genealogía o cuando se registre un eslabón en el índice."
      />
    );
  }

  const range =
    tree.firstBuiltAt && tree.lastBuiltAt && tree.firstBuiltAt !== tree.lastBuiltAt
      ? `${fmtDateTime(tree.firstBuiltAt)} → ${fmtDateTime(tree.lastBuiltAt)}`
      : fmtDateTime(tree.lastBuiltAt ?? tree.firstBuiltAt);
  const totalConsumptions = tree.parts.reduce((n, p) => n + p.consumptions.length, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Componentes (NP)" value={tree.componentCount} icon={Boxes} color={PROD} />
        <Kpi label="Eslabones" value={totalConsumptions} icon={GitBranch} sub="consumos registrados" />
        <Kpi label="Construido" value={fmtRelative(tree.lastBuiltAt) || '—'} icon={Clock} sub={range} />
        <Kpi
          label="Cobertura de lote"
          value={tree.lotCaptureGap ? 'Parcial' : 'Completa'}
          icon={tree.lotCaptureGap ? TriangleAlert : undefined}
          color={tree.lotCaptureGap ? '#f59e0b' : '#10b981'}
        />
      </div>

      {tree.lotCaptureGap && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-700 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Captura de lote parcial: algunos componentes no traen lote/reel (el ledger de piso
            aún no captura lote). El árbol de NP · estación · operador · hora sigue completo y es
            auditable.
          </span>
        </div>
      )}

      <section className={`${glass} rounded-2xl p-5`}>
        {/* Nodo raíz: la unidad */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: PROD }}
          >
            <Factory className="h-4 w-4" />
          </span>
          <span className="font-mono text-lg font-semibold">{tree.serial}</span>
          {tree.model && (
            <Badge color="#5b63e0">
              <Cpu className="h-3 w-3" /> {tree.model}
            </Badge>
          )}
          {tree.woFolio && <Badge color="#7c5cff">{tree.woFolio}</Badge>}
          <span className="ml-auto text-[12px] text-gray-400">As-built · cuna-a-tumba</span>
        </div>

        <div className="mt-2">
          {tree.parts.map((p) => (
            <ComponentNode key={p.part} comp={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ComponentNode({ comp }: { comp: AsBuiltComponent }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="relative pl-6">
      {/* Espina del árbol */}
      <span className="absolute left-2 top-0 h-full w-px bg-black/10 dark:bg-white/10" aria-hidden />
      <span className="absolute left-2 top-[1.35rem] h-px w-3 bg-black/10 dark:bg-white/10" aria-hidden />

      <div className="py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full flex-wrap items-center gap-2 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="font-mono text-sm font-semibold">{comp.part}</span>
          <Badge color="#16a394">{fmtQty(comp.totalQty)} u</Badge>
          {comp.lots.length > 0 && (
            <span className="text-[12px] text-gray-400">
              · {comp.lots.length} lote{comp.lots.length > 1 ? 's' : ''}
            </span>
          )}
          {comp.reels.length > 0 && (
            <span className="text-[12px] text-gray-400">
              · {comp.reels.length} reel{comp.reels.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        {open && (
          <div className="mt-2">
            {(comp.lots.length > 0 || comp.reels.length > 0) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {comp.lots.map((l) => (
                  <Badge key={`l-${l}`} color="#0fb39a" mono>
                    lote {l}
                  </Badge>
                ))}
                {comp.reels.map((r) => (
                  <Badge key={`r-${r}`} color="#0a84ff" mono>
                    reel {r}
                  </Badge>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="text-gray-400">
                  <tr className="border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pr-3 font-medium">Lote / Reel</th>
                    <th className="py-2 pr-3 text-right font-medium">Cant.</th>
                    <th className="py-2 pr-3 font-medium">Estación</th>
                    <th className="py-2 pr-3 font-medium">Operador</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 font-medium">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {comp.consumptions.map((c, idx) => {
                    const sm = sourceMeta(c.source);
                    return (
                      <tr key={idx} className="text-gray-600 dark:text-gray-300">
                        <td className="py-2 pr-3 font-mono">
                          {c.lot && <span>L:{c.lot}</span>}
                          {c.lot && c.reel ? ' · ' : ''}
                          {c.reel && <span>R:{c.reel}</span>}
                          {!c.lot && !c.reel && <span className="text-gray-400">sin lote</span>}
                        </td>
                        <td className="py-2 pr-3 text-right">{fmtQty(c.qty)}</td>
                        <td className="py-2 pr-3">
                          {c.station ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              {c.station}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {c.operator ? (
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3 text-gray-400" />
                              {c.operator}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3">{fmtDateTime(c.consumedAt)}</td>
                        <td className="py-2">
                          <Badge color={sm.color}>{sm.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
