'use client';

/** WHERE-USED inverso: dado un lote/reel defectuoso, qué series lo contienen y
 *  qué embarques/clientes alcanzaría un recall. El alcance de contención. */

import { Boxes, Building2, Radar, ShieldAlert, Truck, type LucideIcon } from 'lucide-react';
import { glass } from '@/lib/glass';
import type { WhereUsedResult } from '../_lib/types';
import { fmtDateTime, fmtQty, sourceMeta } from '../_lib/format';
import { Badge, CopyButton, EmptyState } from './primitives';

const RED = '#ef4444';
const AMBER = '#f59e0b';
const GREEN = '#10b981';

export function WhereUsedView({ result }: { result: WhereUsedResult }) {
  const q = result.query;
  const queryLabel = [
    q.lot ? `lote ${q.lot}` : null,
    q.reel ? `reel ${q.reel}` : null,
    q.part ? `NP ${q.part}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (result.serialCount === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="Sin coincidencias para el lote/reel indicado"
        body="No se encontraron unidades que lo contengan. Nota: la búsqueda inversa por lote sólo resuelve sobre genealogía con lote/reel capturado (índice / terminal); el ledger de piso sin lote no participa."
      />
    );
  }

  const customers = result.recallScope.customers;
  const shipped = result.shipmentCount > 0;

  return (
    <div className="space-y-5">
      {/* Alcance (blast radius) */}
      <div className="rounded-2xl border p-5" style={{ borderColor: `${RED}3a`, background: `${RED}0f` }}>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="h-5 w-5" style={{ color: RED }} />
          <h2 className="text-sm font-semibold" style={{ color: RED }}>
            Alcance de contención (recall)
          </h2>
          {queryLabel && (
            <span className="ml-auto font-mono text-[12px] text-gray-500 dark:text-gray-400">
              {queryLabel}
            </span>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <ScopeStat label="Series afectadas" value={result.serialCount} icon={Boxes} color={RED} />
          <ScopeStat label="Embarques" value={result.shipmentCount} icon={Truck} color={shipped ? AMBER : GREEN} />
          <ScopeStat label="Clientes" value={customers.length} icon={Building2} color={customers.length ? AMBER : GREEN} />
        </div>
        {!shipped && (
          <p className="mt-3 text-[13px] text-emerald-700 dark:text-emerald-300">
            Contención interna: ninguna unidad afectada ha sido embarcada todavía — el material
            sigue en planta.
          </p>
        )}
      </div>

      {/* Conjunto deduplicado, copiable para actuar */}
      <section className={`${glass} rounded-2xl p-5`}>
        <h3 className="text-sm font-semibold">Lista para contención</h3>
        <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
          Conjunto deduplicado sobre el que actúa el recall. Cópialo para bloquear o notificar.
        </p>
        <div className="mt-4 space-y-4">
          <ScopeList title="Series" items={result.recallScope.serials} color="#ff7a45" empty="—" />
          <ScopeList title="Embarques" items={result.recallScope.shipments} color="#0a84ff" empty="Ninguno embarcado" />
          <ScopeList title="Clientes" items={customers} color="#5b63e0" empty="Sin cliente ligado" />
        </div>
      </section>

      {/* Series afectadas */}
      <section className={`${glass} rounded-2xl p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold">Series afectadas</h3>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">({result.affectedSerials.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr className="border-b border-black/5 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Serie</th>
                <th className="py-2 pr-3 font-medium">NP</th>
                <th className="py-2 pr-3 font-medium">Lote / Reel</th>
                <th className="py-2 pr-3 text-right font-medium">Cant.</th>
                <th className="py-2 pr-3 font-medium">WO</th>
                <th className="py-2 pr-3 font-medium">Estación</th>
                <th className="py-2 pr-3 font-medium">Operador</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 font-medium">Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {result.affectedSerials.map((s, idx) => {
                const sm = sourceMeta(s.source);
                return (
                  <tr key={`${s.serial}-${idx}`} className="text-gray-600 dark:text-gray-300">
                    <td className="py-2 pr-3 font-mono font-medium text-foreground">
                      {s.serial}
                    </td>
                    <td className="py-2 pr-3 font-mono">{s.part}</td>
                    <td className="py-2 pr-3 font-mono">
                      {s.lot && <span>L:{s.lot}</span>}
                      {s.lot && s.reel ? ' · ' : ''}
                      {s.reel && <span>R:{s.reel}</span>}
                      {!s.lot && !s.reel && <span className="text-gray-500 dark:text-gray-400">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmtQty(s.qty)}</td>
                    <td className="py-2 pr-3">{s.woFolio ?? '—'}</td>
                    <td className="py-2 pr-3">{s.station ?? '—'}</td>
                    <td className="py-2 pr-3">{s.operator ?? '—'}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{fmtDateTime(s.consumedAt)}</td>
                    <td className="py-2">
                      <Badge color={sm.color}>{sm.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Embarques (camino al cliente) */}
      {shipped && (
        <section className={`${glass} rounded-2xl p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold">Embarques que contienen las series</h3>
            <span className="text-[12px] text-gray-500 dark:text-gray-400">({result.shipments.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="text-gray-500 dark:text-gray-400">
                <tr className="border-b border-black/5 dark:border-white/10">
                  <th className="py-2 pr-3 font-medium">Serie</th>
                  <th className="py-2 pr-3 font-medium">Embarque</th>
                  <th className="py-2 pr-3 font-medium">ASN</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Destino</th>
                  <th className="py-2 font-medium">Embarcado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {result.shipments.map((sh, idx) => (
                  <tr key={`${sh.serial}-${idx}`} className="text-gray-600 dark:text-gray-300">
                    <td className="py-2 pr-3 font-mono">{sh.serial}</td>
                    <td className="py-2 pr-3">{sh.shipmentFolio ?? sh.shipmentId ?? '—'}</td>
                    <td className="py-2 pr-3">{sh.asn ?? '—'}</td>
                    <td className="py-2 pr-3">{sh.customerName ?? '—'}</td>
                    <td className="py-2 pr-3">{sh.destination ?? '—'}</td>
                    <td className="whitespace-nowrap py-2">{fmtDateTime(sh.shippedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ScopeStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ScopeList({
  title,
  items,
  color,
  empty,
}: {
  title: string;
  items: string[];
  color: string;
  empty: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">({items.length})</span>
        {items.length > 0 && (
          <span className="ml-auto">
            <CopyButton text={items.join('\n')} label={`Copiar ${title.toLowerCase()}`} />
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <span className="text-[12px] text-gray-500 dark:text-gray-400">{empty}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <Badge key={it} color={color} mono>
              {it}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
