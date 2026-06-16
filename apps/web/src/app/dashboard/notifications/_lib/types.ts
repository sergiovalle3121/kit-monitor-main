import type { DomainKey } from '@/lib/design/domains';
import type { LucideIcon } from 'lucide-react';

/**
 * Carril UI-NOTIF — modelo unificado del centro de notificaciones.
 *
 * El centro NO inventa datos: normaliza eventos reales que ya viven en el
 * backend (andones de piso, holds de calidad, aprobaciones pendientes y NCRs)
 * a una sola forma para listarlos, filtrarlos por tipo y enlazar al origen.
 */

/** Tipo de evento — alimenta el filtro por tipo. */
export type NotifKind = 'andon' | 'hold' | 'approval' | 'ncr';

/** Severidad normalizada entre todas las fuentes. */
export type NotifSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Una notificación unificada lista para renderizar. */
export interface AxosNotification {
  /**
   * id estable y determinista por fuente (p. ej. `andon:<uuid>`). Sobrevive a
   * los refrescos para que el estado de "leído" (local) se mantenga pegado al
   * evento correcto.
   */
  id: string;
  kind: NotifKind;
  /** Etiqueta corta de la fuente real (p. ej. "Andon · Máquina"). */
  source: string;
  /** Dominio del sistema de diseño → color + loseta. */
  domain: DomainKey;
  /** Ícono (familia lucide) que pinta la loseta. */
  icon: LucideIcon;
  title: string;
  body: string;
  severity: NotifSeverity;
  /** ISO. Momento del evento (raisedAt/createdAt según la fuente). */
  at: string;
  /** Deep-link a la página dueña del dato ("link al origen"). */
  href?: string;
}

/** Notificación con el estado de leído (local) ya resuelto. */
export type ResolvedNotification = AxosNotification & { read: boolean };
