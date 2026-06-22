/**
 * Borradores por conversación, persistidos en localStorage. Lo que escribes en
 * un chat se conserva aunque cambies de conversación o cierres el dock.
 */
const KEY = 'axos_chat_drafts';

function readAll(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function loadDraft(conversationId: string): string {
  return readAll()[conversationId] ?? '';
}

/** Guarda (o borra si queda vacío) el borrador de una conversación. */
export function saveDraft(conversationId: string, text: string): void {
  const map = readAll();
  if (text.trim()) map[conversationId] = text;
  else delete map[conversationId];
  writeAll(map);
}
