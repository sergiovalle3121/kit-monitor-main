/**
 * Comandos slash del composer. El menú aparece cuando el borrador es un único
 * token que empieza por "/". Cada comando se mapea a una acción en
 * ChatExperience por su `id`.
 */
export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'encuesta', label: '/encuesta', hint: 'Crear una encuesta' },
  { id: 'reunion', label: '/reunion', hint: 'Programar una reunión' },
  { id: 'programar', label: '/programar', hint: 'Programar un mensaje' },
  { id: 'ubicacion', label: '/ubicacion', hint: 'Compartir mi ubicación' },
  { id: 'gif', label: '/gif', hint: 'Buscar un GIF' },
  { id: 'contacto', label: '/contacto', hint: 'Compartir un contacto' },
  { id: 'tabla', label: '/tabla', hint: 'Insertar una tabla' },
  { id: 'aldia', label: '/aldia', hint: 'Resumen con IA de la conversación' },
  { id: 'silenciar', label: '/silenciar', hint: 'Silenciar esta conversación 8 h' },
];

/** ¿El borrador es un comando en construcción (un solo token con "/")? */
export function isSlashDraft(text: string): boolean {
  return text.startsWith('/') && !/\s/.test(text);
}

/** Comandos que coinciden con el borrador "/parcial". */
export function matchCommands(text: string): SlashCommand[] {
  if (!isSlashDraft(text)) return [];
  const q = text.slice(1).toLowerCase();
  return SLASH_COMMANDS.filter(
    (c) => c.id.startsWith(q) || c.label.slice(1).startsWith(q),
  );
}

/** Comando exacto (p. ej. "/encuesta"), o null. */
export function exactCommand(text: string): SlashCommand | null {
  const t = text.trim();
  return SLASH_COMMANDS.find((c) => c.label === t || c.id === t.slice(1)) ?? null;
}
