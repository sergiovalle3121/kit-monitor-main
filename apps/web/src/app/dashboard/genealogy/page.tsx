'use client';

/**
 * Visor de TRAZABILIDAD Y GENEALOGÍA. Dos modos:
 *  - Por serie → árbol AS-BUILT (cuna-a-tumba): qué lote/reel de cada NP se
 *    consumió, con operador · estación · hora.  (GET as-built/by-serial/:serial)
 *  - Por lote/reel → WHERE-USED para contención de recall: qué series y embarques
 *    lo contienen.  (GET where-used/by-lot?lot=&reel=&part=)
 *
 * Sólo lectura del backend `genealogy`. No toca otras áreas. Alcanzable por URL
 * directa /dashboard/genealogy y por deep-link ?serial= / ?lot=&reel=&part=.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Network, Radar, ScanSearch, Search, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import type { AsBuiltTree, WhereUsedResult } from './_lib/types';
import { AsBuiltView } from './_components/AsBuiltView';
import { WhereUsedView } from './_components/WhereUsedView';
import { AccessDenied, EmptyState, ErrorCard, Spinner } from './_components/primitives';

type Mode = 'serial' | 'lot';
type LotQuery = { lot: string; reel: string; part: string };

const PROD = '#ff7a45';
const RED = '#ef4444';

function buildWhereUsedPath(q: LotQuery): string {
  const sp = new URLSearchParams();
  if (q.lot) sp.set('lot', q.lot);
  if (q.reel) sp.set('reel', q.reel);
  if (q.part) sp.set('part', q.part);
  return `/genealogy/where-used/by-lot?${sp.toString()}`;
}

export default function GenealogyPage() {
  const [mode, setMode] = useState<Mode>('serial');

  // Modo serie
  const [serialInput, setSerialInput] = useState('');
  const [activeSerial, setActiveSerial] = useState('');

  // Modo lote/reel
  const [lotInput, setLotInput] = useState('');
  const [reelInput, setReelInput] = useState('');
  const [partInput, setPartInput] = useState('');
  const [activeLot, setActiveLot] = useState<LotQuery | null>(null);

  // Deep-link (client-only; evita el bailout de useSearchParams en build).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get('serial');
    const lot = sp.get('lot');
    const reel = sp.get('reel');
    const part = sp.get('part');
    if (s) {
      queueMicrotask(() => {
        setMode('serial');
        setSerialInput(s);
        setActiveSerial(s.trim());
      });
    } else if (lot || reel) {
      queueMicrotask(() => {
        setMode('lot');
        setLotInput(lot ?? '');
        setReelInput(reel ?? '');
        setPartInput(part ?? '');
        setActiveLot({ lot: (lot ?? '').trim(), reel: (reel ?? '').trim(), part: (part ?? '').trim() });
      });
    }
  }, []);

  const asBuiltPath =
    mode === 'serial' && activeSerial
      ? `/genealogy/as-built/by-serial/${encodeURIComponent(activeSerial)}`
      : null;
  const asBuilt = useApi<AsBuiltTree>(asBuiltPath, { refreshInterval: 0 });

  const wherePath =
    mode === 'lot' && activeLot && (activeLot.lot || activeLot.reel)
      ? buildWhereUsedPath(activeLot)
      : null;
  const whereUsed = useApi<WhereUsedResult>(wherePath, { refreshInterval: 0 });

  const runSerial = useCallback(() => {
    const s = serialInput.trim();
    setActiveSerial(s);
    window.history.replaceState(
      null,
      '',
      s ? `?serial=${encodeURIComponent(s)}` : window.location.pathname,
    );
  }, [serialInput]);

  const runLot = useCallback(() => {
    const q: LotQuery = { lot: lotInput.trim(), reel: reelInput.trim(), part: partInput.trim() };
    if (!q.lot && !q.reel) return;
    setActiveLot(q);
    const sp = new URLSearchParams();
    if (q.lot) sp.set('lot', q.lot);
    if (q.reel) sp.set('reel', q.reel);
    if (q.part) sp.set('part', q.part);
    window.history.replaceState(null, '', `?${sp.toString()}`);
  }, [lotInput, reelInput, partInput]);

  const lotDisabled = !lotInput.trim() && !reelInput.trim();

  return (
    <div className="min-h-screen text-foreground">
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>

        <PageHeader
          domain="production"
          icon={Network}
          title="Trazabilidad y genealogía"
          subtitle="As-built por serie (cuna-a-tumba) · where-used por lote/reel para contención de recall"
        />

        {/* Switch de modo */}
        <div className="mb-5 inline-flex rounded-2xl bg-black/5 p-1 dark:bg-white/10">
          <TabButton
            active={mode === 'serial'}
            onClick={() => setMode('serial')}
            icon={ScanSearch}
            label="Por serie · As-built"
          />
          <TabButton
            active={mode === 'lot'}
            onClick={() => setMode('lot')}
            icon={Radar}
            label="Por lote/reel · Recall"
          />
        </div>

        {/* Controles de búsqueda */}
        {mode === 'serial' ? (
          <div className={`${glass} mb-6 rounded-2xl p-4`}>
            <label className="mb-1.5 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
              Número de serie
            </label>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <input
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSerial();
                }}
                placeholder="Escanea o escribe la serie de la unidad…"
                className="gen-input flex-1"
                autoFocus
              />
              <button
                onClick={runSerial}
                disabled={!serialInput.trim()}
                className="shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: PROD }}
              >
                Construir árbol
              </button>
            </div>
          </div>
        ) : (
          <div className={`${glass} mb-6 rounded-2xl p-4`}>
            <div className="grid gap-3 md:grid-cols-3">
              <Labeled label="Lote (defectuoso)">
                <input
                  value={lotInput}
                  onChange={(e) => setLotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runLot();
                  }}
                  placeholder="LOT-2207-A"
                  className="gen-input"
                />
              </Labeled>
              <Labeled label="Reel / carrete">
                <input
                  value={reelInput}
                  onChange={(e) => setReelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runLot();
                  }}
                  placeholder="REEL-00481"
                  className="gen-input"
                />
              </Labeled>
              <Labeled label="NP (opcional)">
                <input
                  value={partInput}
                  onChange={(e) => setPartInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runLot();
                  }}
                  placeholder="CAP-0402-100NF"
                  className="gen-input"
                />
              </Labeled>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12px] text-gray-500 dark:text-gray-400">
                Indica al menos un lote o un reel. El NP acota la búsqueda.
              </span>
              <button
                onClick={runLot}
                disabled={lotDisabled}
                className="shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: RED }}
              >
                Rastrear contención
              </button>
            </div>
          </div>
        )}

        {/* Resultados */}
        {mode === 'serial' ? (
          !activeSerial ? (
            <EmptyState
              icon={ScanSearch}
              title="Busca una serie"
              body="Escribe o escanea un número de serie para ver su árbol as-built: qué lote/reel de cada NP se consumió, con operador, estación y hora."
            />
          ) : asBuilt.forbidden ? (
            <AccessDenied permission="production:report" />
          ) : asBuilt.error ? (
            <ErrorCard />
          ) : asBuilt.isLoading || !asBuilt.data ? (
            <Spinner label="Derivando genealogía…" />
          ) : (
            <AsBuiltView tree={asBuilt.data} />
          )
        ) : !activeLot ? (
          <EmptyState
            icon={Radar}
            title="Rastrea un lote o reel"
            body="Indica el lote/reel defectuoso para ver qué series lo contienen y qué embarques (y clientes) alcanzaría un recall."
          />
        ) : whereUsed.forbidden ? (
          <AccessDenied permission="quality:report" />
        ) : whereUsed.error ? (
          <ErrorCard />
        ) : whereUsed.isLoading || !whereUsed.data ? (
          <Spinner label="Calculando alcance de contención…" />
        ) : (
          <WhereUsedView result={whereUsed.data} />
        )}
      </main>

      <style jsx global>{`
        .gen-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .gen-input:focus {
          border-color: ${PROD};
        }
        :global(.dark) .gen-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
        active
          ? 'bg-white text-black shadow-sm dark:bg-white/15 dark:text-white'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
