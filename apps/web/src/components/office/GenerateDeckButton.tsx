'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Presentation, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Botón «Generar deck» (Fase 4, EMS-native): toma datos ya calculados de la
 * página (`build` los convierte en un mazo v2), crea una presentación de Office
 * y navega a ella. Reutilizable por mission-control y calidad.
 */
export function GenerateDeckButton({ title, build, label = 'Generar deck', disabled, className }: {
  title: string;
  build: () => Promise<any> | any;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true); setErr(false);
    try {
      const content = await build();
      const res = await apiFetch(`${API_BASE}/office-documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'slides', title, content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = await res.json();
      if (doc?.id) router.push(`/dashboard/office/${doc.id}`);
      else throw new Error('respuesta inválida');
    } catch {
      setErr(true); setBusy(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={disabled || busy}
      title="Generar una presentación editable con estos datos"
      className={className ?? 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50'}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : err ? <AlertCircle className="h-4 w-4 text-red-500" /> : <Presentation className="h-4 w-4" />}
      {err ? 'Reintentar' : label}
    </button>
  );
}
