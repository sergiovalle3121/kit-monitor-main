'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Inbox,
  Check,
  X,
  PackageCheck,
  Loader2,
  Lock,
  Radio,
  LineChart,
  Clock,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useMaterialSignals } from '@/hooks/useMaterialSignals';
import { PageHeader } from '@/components/ui/PageHeader';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';

interface MaterialRequest {
  id: number;
  kitId: number;
  requestedBy: string;
  status: 'pending' | 'authorized' | 'rejected' | 'fulfilled' | 'cancelled';
  note?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  createdAt?: string;
  model?: string | null;
  workOrder?: string | null;
  line?: number | null;
  quantity?: number | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: AMBER, bg: 'rgba(245,158,11,0.12)' },
  authorized: { label: 'Autorizado', color: GREEN, bg: 'rgba(16,185,129,0.12)' },
  fulfilled: { label: 'Surtido', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  rejected: { label: 'Rechazado', color: RED, bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export default function AlmacenPage() {
  const { data, isLoading, forbidden, mutate } = useApi<MaterialRequest[]>('/material-requests');
  const [busy, setBusy] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

  const { status: socketStatus } = useMaterialSignals(() => {
    setPulse(true);
    setTimeout(() => setPulse(false), 1200);
    mutate();
  });

  const list = Array.isArray(data) ? data : [];
  const pending = list.filter((r) => r.status === 'pending');
  const authorized = list.filter((r) => r.status === 'authorized');
  const history = list.filter((r) => ['fulfilled', 'rejected', 'cancelled'].includes(r.status));

  async function act(id: number, action: 'authorize' | 'reject' | 'fulfill') {
    setBusy(id);
    try {
      await apiFetch(`${API_BASE}/material-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: socketStatus === 'connected' ? GREEN : AMBER }}>
            <Radio className={`w-3.5 h-3.5 ${pulse ? 'animate-ping' : ''}`} />
            {socketStatus === 'connected' ? 'En vivo' : 'Conectando…'}
          </span>
          <Link href="/dashboard/planning" className="flex items-center gap-1.5 text-sm font-medium text-violet-500 hover:text-violet-700 transition-colors">
            <LineChart className="w-4 h-4" /> Planeación
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="warehouse"
          title="Almacén · Surtido"
          subtitle="Solicitudes de producción en tiempo real · autoriza el surtido del kit"
        />

        {forbidden && (
          <EmptyState icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        )}
        {!forbidden && isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        )}
        {!forbidden && !isLoading && list.length === 0 && (
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="Sin solicitudes"
            body="Cuando producción solicite material de un plan publicado, aparecerá aquí para que lo autorices."
          />
        )}

        {/* Pendientes — lo más importante */}
        {pending.length > 0 && (
          <Section title="Por autorizar" count={pending.length} color={AMBER}>
            {pending.map((r) => (
              <RequestCard key={r.id} r={r} busy={busy === r.id}>
                <button
                  onClick={() => act(r.id, 'authorize')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1.5 bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-60"
                >
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Autorizar
                </button>
                <button
                  onClick={() => act(r.id, 'reject')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1.5 text-red-500 text-sm font-semibold px-4 py-2 rounded-full border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-60"
                >
                  <X className="w-4 h-4" /> Rechazar
                </button>
              </RequestCard>
            ))}
          </Section>
        )}

        {/* Autorizadas — pendientes de surtir */}
        {authorized.length > 0 && (
          <Section title="Autorizadas · por surtir" count={authorized.length} color={GREEN}>
            {authorized.map((r) => (
              <RequestCard key={r.id} r={r} busy={busy === r.id}>
                <button
                  onClick={() => act(r.id, 'fulfill')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-60"
                >
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Marcar surtido
                </button>
              </RequestCard>
            ))}
          </Section>
        )}

        {/* Historial */}
        {history.length > 0 && (
          <Section title="Historial" count={history.length} color="#6b7280">
            {history.map((r) => (
              <RequestCard key={r.id} r={r} busy={false} muted />
            ))}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        {title}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}1f` }}>{count}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RequestCard({ r, busy, muted, children }: { r: MaterialRequest; busy: boolean; muted?: boolean; children?: React.ReactNode }) {
  const meta = STATUS_META[r.status] ?? STATUS_META.pending;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: muted ? 0.7 : 1, y: 0 }}
      className={`${glass} rounded-2xl p-4 flex items-center justify-between gap-4 ${busy ? 'opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: meta.bg }}>
            {meta.label}
          </span>
          {r.workOrder && <span className="text-[11px] text-gray-400 font-mono">WO {r.workOrder}</span>}
        </div>
        <h3 className="text-lg font-bold tracking-tight truncate">{r.model ?? `Kit #${r.kitId}`}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {r.quantity ? `${r.quantity} u · ` : ''}{r.line ? `Línea ${r.line} · ` : ''}Solicitó {r.requestedBy}
        </p>
        {r.note && <p className="text-xs text-gray-400 mt-1 italic">“{r.note}”</p>}
        {r.decidedBy && (
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {meta.label.toLowerCase()} por {r.decidedBy}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </motion.div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
