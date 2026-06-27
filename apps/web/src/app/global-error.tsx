'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[axos] global error:', error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-10 text-white">
          <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-rose-500/15 text-rose-300">
              <AlertOctagon className="size-7" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">AXOS OS</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">La app necesita reiniciarse</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Detectamos un fallo inesperado antes de montar la interfaz. Reintenta y comparte la referencia si persiste.
            </p>
            {error?.digest && (
              <p className="mt-4 rounded-2xl bg-white/10 px-3 py-2 font-mono text-[11px] text-white/50">
                ref: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
