import {
  Siren, Wrench, Package, Hand, ShieldAlert, ShieldX, ShieldCheck, Clock, FileWarning,
  type LucideIcon,
} from 'lucide-react';
import type { DomainKey } from '@/lib/design/domains';
import type { AxosNotification, NotifKind, NotifSeverity } from './types';

/**
 * Carril UI-NOTIF — adaptadores de cada fuente real al modelo unificado.
 *
 * Cada normalizador es una función pura `(raw) => AxosNotification[]` defensiva:
 * tolera respuestas envueltas, vacías o con campos faltantes, porque varias de
 * estas APIs no comparten un mismo contrato (camelCase vs snake_case, etc.).
 */

// ── Helpers ────────────────────────────────────────────────────────────────
function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  // Algunos endpoints envuelven en { data: [...] } o { items: [...] }.
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

/** Primer valor de fecha presente → ISO. Cubre raisedAt / createdAt / created_at. */
function pickAt(...vals: Array<string | Date | null | undefined>): string {
  for (const v of vals) {
    if (!v) continue;
    const d = typeof v === 'string' ? new Date(v) : v;
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function normSev(s?: string | null): NotifSeverity {
  switch ((s || '').toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': case 'MAJOR': return 'high';
    case 'MEDIUM': return 'medium';
    case 'LOW': case 'MINOR': return 'low';
    default: return 'info';
  }
}

function clip(s: string | null | undefined, n = 90): string {
  const t = (s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Une partes no vacías con " · ". */
function join(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => Boolean(p && String(p).trim())).join(' · ');
}

// ── Presentación por tipo (chips de filtro + acento de fila) ─────────────────
export const KIND_META: Record<NotifKind, { label: string; color: string; domain: DomainKey }> = {
  andon: { label: 'Andon', color: '#ef4444', domain: 'production' },
  hold: { label: 'Holds de calidad', color: '#f59e0b', domain: 'quality' },
  approval: { label: 'Aprobaciones', color: '#7c3aed', domain: 'planning' },
  ncr: { label: 'NCR', color: '#2ec27e', domain: 'quality' },
};

export const SEV_META: Record<NotifSeverity, { label: string; color: string }> = {
  critical: { label: 'Crítico', color: '#ef4444' },
  high: { label: 'Alto', color: '#f97316' },
  medium: { label: 'Medio', color: '#f59e0b' },
  low: { label: 'Bajo', color: '#3b82f6' },
  info: { label: '', color: '#6b7280' },
};

// ── 1) Andon — /operator-terminal/floor-events?status=OPEN ───────────────────
interface RawFloorEvent {
  id: string;
  type: string; // ANDON_MATERIAL | ANDON_QUALITY | ANDON_MACHINE | ANDON_HELP | ANDON_SAFETY | DEFECT | DOWNTIME
  status: string; // OPEN | ACK | RESOLVED | CANCELLED
  woFolio?: string | null;
  line?: string | null;
  station?: string | null;
  model?: string | null;
  part?: string | null;
  severity?: string | null;
  note?: string | null;
  raisedAt?: string | null;
  raisedBy?: string | null;
  created_at?: string | null;
}

const ANDON: Record<string, { label: string; icon: LucideIcon; domain: DomainKey }> = {
  ANDON_MATERIAL: { label: 'Andon · Material', icon: Package, domain: 'staging' },
  ANDON_QUALITY: { label: 'Andon · Calidad', icon: ShieldAlert, domain: 'quality' },
  ANDON_MACHINE: { label: 'Andon · Máquina', icon: Wrench, domain: 'production' },
  ANDON_HELP: { label: 'Andon · Ayuda', icon: Hand, domain: 'production' },
  ANDON_SAFETY: { label: 'Andon · Seguridad', icon: ShieldAlert, domain: 'production' },
};

export function normalizeAndon(raw: unknown): AxosNotification[] {
  return asArray<RawFloorEvent>(raw)
    .filter((e) => typeof e?.type === 'string' && e.type.startsWith('ANDON'))
    .filter((e) => e.status === 'OPEN' || e.status === 'ACK')
    .map((e) => {
      const meta = ANDON[e.type] ?? { label: 'Andon', icon: Siren, domain: 'production' as DomainKey };
      return {
        id: `andon:${e.id}`,
        kind: 'andon' as const,
        source: e.status === 'ACK' ? `${meta.label} · atendiéndose` : meta.label,
        domain: meta.domain,
        icon: meta.icon,
        title: join(e.line ? `Línea ${e.line}` : null, e.station, e.model) || 'Llamado de piso',
        body: clip(join(e.note, e.woFolio ? `WO ${e.woFolio}` : null, e.part, e.raisedBy ? `por ${e.raisedBy}` : null)) || 'Andon abierto en la estación',
        severity: normSev(e.severity),
        at: pickAt(e.raisedAt, e.created_at),
        href: '/dashboard/operador',
      };
    });
}

// ── 2) Holds de calidad — /floor-quality/holds ───────────────────────────────
interface RawHold {
  id: string;
  folio?: string | null;
  origin?: string | null;
  part: string;
  qty?: number;
  lot?: string | null;
  serial?: string | null;
  woFolio?: string | null;
  station?: string | null;
  defectType?: string | null;
  severity?: string | null;
  status: string; // HELD | MRB_REVIEW | DISPOSITIONED | REWORK | REINSPECT | CLOSED | CANCELLED
  raisedAt?: string | null;
  raisedBy?: string | null;
  created_at?: string | null;
}

const HOLD_STATUS: Record<string, string> = {
  HELD: 'Retenido', MRB_REVIEW: 'En MRB', DISPOSITIONED: 'Dispuesto',
  REWORK: 'En retrabajo', REINSPECT: 'Re-inspección',
};

export function normalizeHolds(raw: unknown): AxosNotification[] {
  return asArray<RawHold>(raw)
    .filter((h) => h.status !== 'CLOSED' && h.status !== 'CANCELLED')
    .map((h) => ({
      id: `hold:${h.id}`,
      kind: 'hold' as const,
      source: join('Hold de calidad', HOLD_STATUS[h.status] || null),
      domain: 'quality' as DomainKey,
      icon: ShieldX,
      title: join(h.folio, h.part) || h.part || 'Hold',
      body: clip(join(
        h.origin,
        h.defectType,
        h.woFolio ? `WO ${h.woFolio}` : null,
        h.qty ? `${h.qty} u` : null,
        h.lot ? `lote ${h.lot}` : null,
        h.serial ? `SN ${h.serial}` : null,
      )) || 'Material en cuarentena',
      severity: normSev(h.severity),
      at: pickAt(h.raisedAt, h.created_at),
      href: '/dashboard/floor-quality',
    }));
}

// ── 3a) Aprobaciones · Disposiciones — /quality/dispositions ─────────────────
interface RawDisposition {
  id: number;
  type?: string;
  status: string; // proposed | under_review | approved | executed | closed
  reason?: string | null;
  quantity?: number;
  partNumber?: string;
  proposedBy?: string;
  ncr?: { ncrNumber?: string } | null;
  createdAt?: string | null;
}

const DISP_TYPE: Record<string, string> = {
  release: 'Liberar', scrap: 'Desecho', rtv: 'Devolver a proveedor',
  rework: 'Retrabajo', use_as_is: 'Usar como está',
};

export function normalizeDispositions(raw: unknown): AxosNotification[] {
  return asArray<RawDisposition>(raw)
    .filter((d) => d.status === 'proposed' || d.status === 'under_review')
    .map((d) => ({
      id: `disp:${d.id}`,
      kind: 'approval' as const,
      source: 'Aprobación · Disposición',
      domain: 'quality' as DomainKey,
      icon: ShieldCheck,
      title: join(d.type ? DISP_TYPE[d.type] || d.type : 'Disposición', d.partNumber) || 'Disposición pendiente',
      body: clip(join(
        d.ncr?.ncrNumber || null,
        d.reason,
        d.quantity ? `${d.quantity} u` : null,
        d.proposedBy ? `propuesta por ${d.proposedBy}` : null,
      )) || 'Pendiente de aprobación de MRB',
      severity: 'medium' as const,
      at: pickAt(d.createdAt),
      href: '/dashboard/quality',
    }));
}

// ── 3b) Aprobaciones · Cancelaciones — /cancellation-requests/pending ────────
interface RawCancellation {
  id: number;
  requestedBy?: string;
  status?: string;
  createdAt?: string | null;
  expiresAt?: string | null;
  kit?: { name?: string; partNumber?: string } | null;
  publication?: { id?: number; title?: string } | null;
}

export function normalizeCancellations(raw: unknown): AxosNotification[] {
  return asArray<RawCancellation>(raw)
    // /pending ya filtra, pero somos defensivos si llega 'recent' por error.
    .filter((c) => !c.status || c.status === 'pending')
    .map((c) => ({
      id: `cancel:${c.id}`,
      kind: 'approval' as const,
      source: 'Aprobación · Cancelación',
      domain: 'planning' as DomainKey,
      icon: Clock,
      title: join('Cancelación', c.kit?.name || c.kit?.partNumber || c.publication?.title || null) || 'Cancelación solicitada',
      body: clip(join(
        c.requestedBy ? `Solicitada por ${c.requestedBy}` : 'Solicitud de cancelación',
        c.expiresAt ? `vence ${new Date(c.expiresAt).toLocaleDateString()}` : null,
      )),
      severity: 'medium' as const,
      at: pickAt(c.createdAt),
      href: '/dashboard/cancellation-requests',
    }));
}

// ── 4) NCR nuevos — /ncr ─────────────────────────────────────────────────────
interface RawNcr {
  id: number;
  ncrNumber?: string;
  status?: string; // open | under_review | contained | dispositioned | closed
  severity?: string | null;
  partNumber?: string;
  category?: string;
  description?: string;
  line?: string | null;
  customer?: string | null;
  createdAt?: string | null;
}

export function normalizeNcr(raw: unknown): AxosNotification[] {
  return asArray<RawNcr>(raw)
    .filter((n) => n.status === 'open' || n.status === 'under_review')
    .map((n) => ({
      id: `ncr:${n.id}`,
      kind: 'ncr' as const,
      source: n.status === 'under_review' ? 'NCR · en revisión' : 'NCR · nuevo',
      domain: 'quality' as DomainKey,
      icon: FileWarning,
      title: join(n.ncrNumber, n.partNumber) || n.ncrNumber || `NCR #${n.id}`,
      body: clip(join(n.category, n.description, n.line ? `Línea ${n.line}` : null, n.customer)) || 'No conformidad registrada',
      severity: normSev(n.severity),
      at: pickAt(n.createdAt),
      href: `/dashboard/quality/ncr/${n.id}`,
    }));
}
