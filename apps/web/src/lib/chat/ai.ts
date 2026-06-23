'use client';

/**
 * Utilidades de IA para el chat. Reutilizan el proxy del copiloto
 * (`/api/ai/chat`, que responde `{ reply }`). Si el copiloto no está
 * configurado para el tenant, `reply` traerá un mensaje de error que el
 * llamador maneja con gracia.
 */
async function ask(message: string): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = (await res.json().catch(() => ({}))) as { reply?: string };
  return (data?.reply ?? '').trim();
}

/** Resumen "ponerme al día" de una conversación (viñetas breves en español). */
export function aiCatchUp(lines: string[]): Promise<string> {
  const convo = lines.join('\n').slice(0, 6000);
  return ask(
    'Resume en español, en 3 a 5 viñetas breves, los puntos clave, decisiones ' +
      'y pendientes de esta conversación de chat de trabajo. Devuelve solo las ' +
      'viñetas, sin preámbulo.\n\n' +
      convo,
  );
}

/** Tres respuestas cortas sugeridas a partir del contexto reciente. */
export async function aiSuggestReplies(lines: string[]): Promise<string[]> {
  const convo = lines.join('\n').slice(0, 4000);
  const raw = await ask(
    'Eres un asistente que sugiere respuestas para un chat de trabajo en ' +
      'español. Con base en la conversación, propone EXACTAMENTE 3 respuestas ' +
      'cortas (máx 8 palabras cada una), naturales y distintas entre sí, como ' +
      'las escribiría la última persona que debe responder. Devuelve SOLO un ' +
      'arreglo JSON de strings.\n\n' +
      convo,
  );
  return parseList(raw);
}

/** Reescribe/mejora un borrador conservando idioma e intención. */
export function aiRewrite(draft: string): Promise<string> {
  return ask(
    'Reescribe el siguiente mensaje de chat de trabajo para que sea claro, ' +
      'cordial y profesional. Conserva el idioma original y la intención. ' +
      'Devuelve SOLO el mensaje reescrito, sin comillas ni explicaciones.\n\n' +
      draft,
  );
}

/** Convierte una respuesta de IA en una lista de hasta 3 sugerencias. */
function parseList(raw: string): string[] {
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) {
      const arr = JSON.parse(m[0]) as unknown[];
      if (Array.isArray(arr)) {
        return arr
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 3);
      }
    }
  } catch {
    /* no era JSON: caemos al parseo por líneas */
  }
  return raw
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}
