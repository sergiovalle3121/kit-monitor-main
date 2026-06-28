'use client';

import React, { useState } from 'react';
import { ChevronRight, User, Clock, Copy, Check, ArrowRight, Hash } from 'lucide-react';
import { glass } from '@/lib/glass';
import {
  type LedgerEvent,
  domainMeta,
  humanizeAction,
  formatRelative,
  formatDateTime,
  formatTime,
  contextChips,
  diffStates,
  shortValue,
} from './types';

/**
 * Tarjeta de un evento del ledger. Colapsada muestra el "qué/quién/cuándo";
 * expandida revela el detalle de auditoría (transacción, motivo, diff
 * antes→después y el JSON crudo del evento, copiable). Se reutiliza tanto en el
 * timeline global como en el historial por entidad, de modo que un evento se ve
 * idéntico sin importar desde dónde se mire.
 */
export function EventCard({
  event,
  showReference = true,
  onPickReference,
}: {
  event: LedgerEvent;
  /** Oculta el chip de referencia (útil en el historial, donde ya es el contexto). */
  showReference?: boolean;
  /** Permite saltar al historial de la entidad referenciada por el evento. */
  onPickReference?: (referenceType: string, referenceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = domainMeta(event.domain);
  const Icon = meta.icon;
  const chips = contextChips(event);
  const diffs = diffStates(event.metadata?.beforeState, event.metadata?.afterState);
  const actor = event.actorName || (event.actorId ? `#${event.actorId}` : 'sistema');
  const reason = event.metadata?.reasonDesc || event.metadata?.reasonCode;

  async function copyJson(ev: React.MouseEvent) {
    ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible — silencioso */
    }
  }

  return (
    <div className={`${glass} rounded-2xl overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
      >
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${meta.color}1f`, color: meta.color }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{humanizeAction(event.action)}</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: `${meta.color}1a`, color: meta.color }}
            >
              {event.domain}
            </span>
            {showReference && event.referenceType && (
              <span
                onClick={(e) => {
                  if (!onPickReference || !event.referenceId) return;
                  e.stopPropagation();
                  onPickReference(event.referenceType!, event.referenceId);
                }}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500 inline-flex items-center gap-1 ${
                  onPickReference && event.referenceId ? 'cursor-pointer hover:text-foreground' : ''
                }`}
                title={onPickReference && event.referenceId ? 'Ver historial de esta entidad' : undefined}
              >
                <Hash className="h-2.5 w-2.5" />
                {event.referenceType}
                {event.referenceId ? `:${event.referenceId}` : ''}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap text-[12px] text-gray-400">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {actor}
            </span>
            <span className="inline-flex items-center gap-1" title={formatDateTime(event.timestamp)}>
              <Clock className="h-3 w-3" /> {formatTime(event.timestamp)} · {formatRelative(event.timestamp)}
            </span>
            {reason && <span className="truncate">· {reason}</span>}
          </div>

          {chips.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {chips.map((c) => (
                <span
                  key={c.label + c.value}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-gray-500"
                >
                  <span className="text-gray-400">{c.label}</span>{' '}
                  <span className="font-medium text-gray-600 dark:text-gray-300">{c.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronRight
          className={`h-4 w-4 shrink-0 text-gray-400 mt-1 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-black/5 dark:border-white/10">
          {/* Transacción */}
          {event.transaction && Object.keys(event.transaction).length > 0 && (
            <DetailBlock title="Transacción">
              <div className="flex items-center gap-2 flex-wrap text-[12px]">
                {event.transaction.quantity !== undefined && event.transaction.quantity !== null && (
                  <span className="font-medium">
                    {event.transaction.quantity} {event.transaction.unit ?? ''}
                  </span>
                )}
                {(event.transaction.fromLocation || event.transaction.toLocation) && (
                  <span className="inline-flex items-center gap-1.5 text-gray-500">
                    <span className="font-mono">{event.transaction.fromLocation ?? '—'}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-mono">{event.transaction.toLocation ?? '—'}</span>
                  </span>
                )}
              </div>
            </DetailBlock>
          )}

          {/* Diff antes → después */}
          {diffs.length > 0 && (
            <DetailBlock title={`Cambios (${diffs.length})`}>
              <div className="space-y-1">
                {diffs.map((d) => (
                  <div key={d.key} className="grid grid-cols-[minmax(70px,auto)_1fr] gap-2 text-[12px] items-baseline">
                    <span className="font-mono text-gray-500 truncate">{d.key}</span>
                    <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-mono text-red-500/80 line-through decoration-red-500/40 break-all">
                        {shortValue(d.before, 60)}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 break-all">
                        {shortValue(d.after, 60)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </DetailBlock>
          )}

          {/* Metadatos técnicos */}
          {(event.metadata?.httpMethod || event.metadata?.path || event.metadata?.durationMs !== undefined) && (
            <DetailBlock title="Origen">
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400 font-mono">
                {event.metadata?.httpMethod && <span>{event.metadata.httpMethod}</span>}
                {event.metadata?.path && <span className="truncate">{event.metadata.path}</span>}
                {event.metadata?.durationMs !== undefined && <span>{event.metadata?.durationMs} ms</span>}
              </div>
            </DetailBlock>
          )}

          {/* Pie de auditoría: id inmutable + copiar JSON crudo */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-gray-400 inline-flex items-center gap-1">
              <Hash className="h-2.5 w-2.5" /> {event.id}
            </span>
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar JSON'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">{title}</div>
      {children}
    </div>
  );
}
