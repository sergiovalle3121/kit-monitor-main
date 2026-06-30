'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Inbox,
  Check,
  X,
  PackageCheck,
  Loader2,
  Lock,
  Radio,
  LineChart,
  Clock,
  MapPin,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
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

interface KitMaterialLine {
  id: number;
  partNumber: string;
  description?: string | null;
  quantityRequired: number;
  quantityRemaining?: number | null;
  unit: string;
}

interface Position {
  partNumber: string;
  location?: string;
  warehouse?: { name?: string; code?: string } | null;
  onHand?: number;
  allocated?: number;
  holdStatus?: string;
}

/** Una ubicación de picking sugerida para una parte (rack/bin + disponible). */
interface PickLoc { location: string; available: number; warehouse?: string }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: AMBER, bg: 'rgba(245,158,11,0.12)' },
  authorized: { label: 'Autorizado', color: GREEN, bg: 'rgba(16,185,129,0.12)' },
  fulfilled: { label: 'Surtido', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  rejected: { label: 'Rechazado', color: RED, bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Cancelado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export default function AlmacenPage() {
  const { data, isLoading, forbidden, mutate } = useApi<MaterialRequest[]>('/material-requests');
  // Posiciones reales para sugerir DE DÓNDE surtir cada material del kit.
  const { data: posData } = useApi<Position[]>('/inventory/positions');
  const [busy, setBusy] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);

  // Mapa parte → ubicaciones disponibles (rack/bin), mayor disponible primero.
  const posByPart = useMemo(() => {
    const m = new Map<string, PickLoc[]>();
    for (const p of Array.isArray(posData) ? posData : []) {
      if ((p.holdStatus ?? 'available') !== 'available') continue;
      const available = Number(p.onHand ?? 0) - Number(p.allocated ?? 0);
      if (available <= 0) continue;
      const arr = m.get(p.partNumber) ?? [];
      arr.push({ location: p.location || 'BULK', available, warehouse: p.warehouse?.name ?? undefined });
      m.set(p.partNumber, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.available - a.available);
    return m;
  }, [posData]);

  const pickLocations = (part: string): PickLoc[] => posByPart.get(part) ?? [];

  const { status: socketStatus } = useMaterialSignals(() => {
    setPulse(true);
    setTimeout(() => setPulse(false), 1200);
    mutate();
  });
  const toast = useToast();

  const list = Array.isArray(data) ? data : [];
  const pending = list.filter((r) => r.status === 'pending');
  const authorized = list.filter((r) => r.status === 'authorized');
  const history = list.filter((r) => ['fulfilled', 'rejected', 'cancelled'].includes(r.status));

  async function act(id: number, action: 'authorize' | 'reject' | 'fulfill') {
    setBusy(id);
    try {
      const res = await apiFetch(`${API_BASE}/material-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(typeof d.message === 'string' ? d.message : 'No se pudo completar la acción.', 'Almacén');
        return;
      }
      mutate();
    } catch {
      toast.error('No se pudo contactar el backend.', 'Almacén');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="warehouse"
          title="Almacén · Surtido"
          subtitle="Solicitudes de producción en tiempo real · autoriza el surtido del kit"
          right={
            <>
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: socketStatus === 'connected' ? GREEN : AMBER }}>
                <Radio className={`w-3.5 h-3.5 ${pulse ? 'animate-ping' : ''}`} />
                {socketStatus === 'connected' ? 'En vivo' : 'Conectando…'}
              </span>
              <Link href="/dashboard/planning" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary transition-colors">
                <LineChart className="w-4 h-4" /> Planeación
              </Link>
            </>
          }
        />

        {forbidden && (
          <EmptyState icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        )}
        {!forbidden && isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
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
              <RequestCard key={r.id} r={r} busy={busy === r.id} pickLocations={pickLocations}>
                <button
                  onClick={() => act(r.id, 'authorize')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1.5 bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-emerald-800 active:scale-95 transition-all disabled:opacity-60"
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
              <RequestCard key={r.id} r={r} busy={busy === r.id} pickLocations={pickLocations}>
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
              <RequestCard key={r.id} r={r} busy={false} muted pickLocations={pickLocations} />
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

function RequestCard({ r, busy, muted, children, pickLocations }: { r: MaterialRequest; busy: boolean; muted?: boolean; children?: React.ReactNode; pickLocations: (part: string) => PickLoc[] }) {
  const meta = STATUS_META[r.status] ?? STATUS_META.pending;
  const [open, setOpen] = useState(false);
  // BOM-derived materials to pick for this kit (exploded from the model's BOM on publish).
  const { data: matsData } = useApi<KitMaterialLine[]>(open && r.kitId ? `/kit-materials?kitId=${r.kitId}` : null);
  const mats = Array.isArray(matsData) ? matsData : [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: muted ? 0.7 : 1, y: 0 }}
      className={`${glass} rounded-2xl p-4 ${busy ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: meta.bg }}>
              {meta.label}
            </span>
            {r.workOrder && <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">WO {r.workOrder}</span>}
          </div>
          <h3 className="text-lg font-bold tracking-tight truncate">{r.model ?? `Kit #${r.kitId}`}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {r.quantity ? `${r.quantity} u · ` : ''}{r.line ? `Línea ${r.line} · ` : ''}Solicitó {r.requestedBy}
          </p>
          {r.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">“{r.note}”</p>}
          {r.decidedBy && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {meta.label.toLowerCase()} por {r.decidedBy}
            </p>
          )}
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>

      {/* Materials to pick (from the kit, exploded from the model BOM) */}
      {r.kitId ? (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
          <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-gray-500 hover:text-foreground flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5" /> {open ? 'Ocultar materiales' : 'Ver materiales del kit'}
          </button>
          {open && (
            mats.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Sin líneas de material en el kit.</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {mats.map((m) => {
                  const locs = pickLocations(m.partNumber);
                  return (
                    <div key={m.id} className="text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] truncate">{m.partNumber}{m.description ? <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">{m.description}</span> : null}</span>
                        <span className="tabular-nums text-xs flex-shrink-0">
                          <span className="font-semibold">{m.quantityRequired} {m.unit}</span>
                          {typeof m.quantityRemaining === 'number' ? <span className="text-gray-500 dark:text-gray-400"> · faltan {m.quantityRemaining}</span> : null}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {locs.length === 0 ? (
                          <span>Sin ubicación con stock disponible</span>
                        ) : (
                          <span className="truncate">
                            {locs.slice(0, 2).map((l) => `${l.location} (${l.available})`).join(' · ')}
                            {locs.length > 2 ? ` +${locs.length - 2}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
