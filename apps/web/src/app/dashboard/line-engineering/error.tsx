'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, ChevronLeft } from 'lucide-react';
import { glass } from '@/lib/glass';

/**
 * Route-segment error boundary for the line-engineering page. Without it, any
 * render error here bubbles to Next's bare "This page couldn't load" screen
 * (no app shell, no diagnostics). This catches the error, keeps the dashboard
 * shell, offers a retry, surfaces the digest for support, and logs the real
 * error to the console so the underlying cause can be pinpointed.
 */
export default function LineEngineeringError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError =
    error?.name === 'ChunkLoadError' ||
    /Loading chunk|Failed to load chunk|error loading dynamically imported module|importing a module script failed/i.test(
      error?.message || '',
    );

  useEffect(() => {
    // Production redacts the message in the UI; the console keeps the real one.
    console.error('[line-engineering] route error:', error);
    // Stale-deploy chunk failure → reload once to pull the fresh bundle.
    if (chunkError && typeof window !== 'undefined') {
      try {
        if (!sessionStorage.getItem('axos_chunk_reloaded')) {
          sessionStorage.setItem('axos_chunk_reloaded', '1');
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }, [error, chunkError]);

  return (
    <div className="min-h-screen grid place-items-center text-foreground p-6">
      <div className={`${glass} rounded-3xl p-8 text-center max-w-md`}>
        <AlertTriangle className="w-9 h-9 mx-auto mb-3 text-amber-500" />
        <h2 className="text-lg font-semibold">
          {chunkError ? 'Hay una versión nueva de la app' : 'No se pudo cargar la disposición de líneas'}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {chunkError
            ? 'Recarga la página para cargar los archivos actualizados.'
            : 'Ocurrió un error al mostrar esta vista. Reintenta; si persiste, comparte el código de abajo.'}
        </p>
        {!chunkError && error?.digest && (
          <p className="mt-3 text-[11px] font-mono text-gray-400 break-all">ref: {error.digest}</p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => (chunkError ? window.location.reload() : reset())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: '#f43f5e' }}
          >
            <RotateCcw className="w-4 h-4" /> {chunkError ? 'Recargar' : 'Reintentar'}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
