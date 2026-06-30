'use client';

import React from 'react';

/**
 * Minimal client error boundary. Wrap a heavy/optional widget so a crash inside
 * it shows a local fallback (with a retry) instead of taking down the whole
 * route. React error boundaries must be class components.
 *
 * Special-cases ChunkLoadError: after a redeploy the chunk hashes change, so a
 * browser still holding the old page can fail to lazy-load a chunk. That throws
 * a ChunkLoadError that otherwise white-screens the route. Here we auto-reload
 * once (a fresh load fetches the new chunks) and, if it still fails, offer a
 * manual reload — instead of a dead end.
 */
interface Props {
  children: React.ReactNode;
  /** Rendered when a child throws. Receives the error and a retry callback. */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** Optional label to tag console logs. */
  label?: string;
}
interface State {
  error: Error | null;
}

const RELOAD_FLAG = 'axos_chunk_reloaded';

function isChunkError(error: Error): boolean {
  const name = error?.name || '';
  const msg = error?.message || '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk|Failed to load chunk|error loading dynamically imported module|importing a module script failed/i.test(
      msg,
    )
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`, error, info);
    // Stale-deploy chunk failure → reload once to pull the fresh bundle.
    if (isChunkError(error) && typeof window !== 'undefined') {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
        }
      } catch {
        /* sessionStorage may be unavailable — fall through to manual reload */
      }
    }
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (isChunkError(error)) {
        return (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-500/10 p-6 text-center">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Hay una versión nueva de la app.</p>
            <p className="text-[12px] text-gray-500 mt-1">Recarga para cargar los archivos actualizados.</p>
            <button onClick={() => window.location.reload()} className="mt-3 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: '#b45309' }}>
              Recargar página
            </button>
          </div>
        );
      }
      if (this.props.fallback) return this.props.fallback(error, this.retry);
      return (
        <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-500/10 p-6 text-center">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Algo falló al mostrar este panel.</p>
          <button onClick={this.retry} className="mt-3 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: '#b45309' }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
