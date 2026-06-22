/** Tamaño legible (B / KB / MB) para previews y adjuntos. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Etiqueta corta para la hora del último mensaje en la lista (estilo WhatsApp):
 * hoy → hora; ayer → "Ayer"; esta semana → día; antes → fecha corta.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (dayDiff <= 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 1) return 'Ayer';
  if (dayDiff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

/** "visto hace…" para usuarios desconectados (a partir de lastSeenAt). */
export function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'visto hace un momento';
  if (min < 60) return `visto hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `visto hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'visto ayer';
  if (days < 7) return `visto hace ${days} d`;
  return `visto el ${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}`;
}

