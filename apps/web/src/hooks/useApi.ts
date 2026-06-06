'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Error con código HTTP para que la UI distinga 401/403 (sin acceso) de
 * otros fallos y muestre el estado correcto en cada tile.
 */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function fetcher<T>(path: string): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status);
  }
  const json = await res.json();
  // Desenvuelve { success, data } si el backend lo manda envuelto.
  return (json && typeof json === 'object' && 'data' in json && 'success' in json)
    ? (json.data as T)
    : (json as T);
}

/**
 * useApi<T>(path, options): wrapper de SWR con auto-refresh cada 20s y
 * dedupe. Devuelve `forbidden` cuando el backend responde 401/403 para que
 * la UI muestre "sin acceso" en vez de un error genérico.
 */
export function useApi<T>(path: string | null, opts?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    path,
    (p) => fetcher<T>(p as string),
    {
      refreshInterval: 20000,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
      shouldRetryOnError: (err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)),
      ...opts,
    },
  );
  const forbidden = error instanceof ApiError && (error.status === 401 || error.status === 403);
  return { data, error, isLoading, forbidden, mutate };
}
