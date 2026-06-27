'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, RotateCcw } from 'lucide-react';
import { glass } from '@/lib/glass';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = /ChunkLoadError|Loading chunk|Failed to load chunk|importing a module script failed/i.test(
    `${error?.name || ''} ${error?.message || ''}`,
  );

  useEffect(() => {
    console.error('[dashboard] route error:', error);

    if (!chunkError || typeof window === 'undefined') return;

    try {
      const reloadKey = 'axos_dashboard_chunk_reloaded';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    } catch {
      // If storage is unavailable, leave the retry button as the fallback.
    }
  }, [chunkError, error]);

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10 text-slate-950 dark:text-white">
      <section className={`${glass} w-full max-w-lg rounded-[2rem] p-8 text-center shadow-2xl`}>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-white/50">
          AXOS OS
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          {chunkError ? 'Hay una versión nueva disponible' : 'No se pudo cargar esta vista'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/60">
          {chunkError
            ? 'Recarga para sincronizar los bundles más recientes de la app.'
            : 'Reintenta la vista. Si el problema persiste, comparte la referencia técnica con el equipo.'}
        </p>
        {error?.digest && (
          <p className="mt-4 rounded-2xl bg-black/5 px-3 py-2 font-mono text-[11px] text-slate-500 dark:bg-white/10 dark:text-white/50">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => (chunkError ? window.location.reload() : reset())}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {chunkError ? 'Recargar' : 'Reintentar'}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
