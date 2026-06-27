/**
 * Automatic model escalation.
 *
 * Routine grounded look-ups run on the cheap default model. When a question is
 * genuinely analytical — asking for a cause, a trend, a comparison, a
 * recommendation — the stronger (and pricier-to-run) escalation model produces a
 * better answer. This module decides, from the user's message alone, whether to
 * escalate.
 *
 * It is **off by default** and gated by `CIDE_AUTO_ESCALATE=1`, because the
 * escalation model (e.g. qwen2.5:32b) must actually be served by the engine —
 * enabling it on a CPU deploy that only loaded the 7B model would 404. GPU
 * deploys serving both tiers can safely turn it on.
 *
 * The heuristic is a pure function so it is unit-tested in isolation.
 */

/** Whether automatic escalation is enabled for this process. */
export const AUTO_ESCALATE = process.env.CIDE_AUTO_ESCALATE === '1';

/**
 * Phrases that signal an analytical, multi-step ask (Spanish first, since that
 * is the default UI language, plus a few English equivalents).
 */
const ANALYTICAL_TRIGGERS: RegExp[] = [
  /por\s*qu[eé]|porqu[eé]/i, // por qué / porqué
  /an[aá]li(z|c|s)/i, // analiza / analices / análisis
  /\bcompar/i, // compara / comparación / comparativo
  /\btendencia|evoluci[oó]n\b/i,
  /\bcausa|ra[ií]z\b/i, // causa / raíz (root cause)
  /\bproyec|pron[oó]stic|predic/i, // proyección / pronóstico / predicción
  /\boptimiz/i,
  /\bdiagn[oó]stic/i,
  /\brecomien|recomendaci[oó]n\b/i,
  /\beval[uú]a|eval[uú]aci[oó]n\b/i,
  /\bestrateg/i,
  /\bsimula|escenario\b/i,
  /\bdesglos|drill\s*down\b/i,
  /\bwhy\b|\banalyze|\bcompare|\btrend|\bforecast|\brecommend|\boptimi[sz]e/i,
];

/**
 * Decide whether a message warrants the escalation tier. Conservative on
 * purpose: short factual questions ("¿Cómo está el inventario?") stay on the
 * default model.
 */
export function shouldEscalate(message: string): boolean {
  const m = (message ?? '').trim();
  if (!m) return false;
  const hits = ANALYTICAL_TRIGGERS.reduce(
    (n, re) => (re.test(m) ? n + 1 : n),
    0,
  );
  // A long, detailed prompt is itself a signal of a complex ask.
  if (m.length >= 240) return true;
  // Two or more analytical cues → clearly an analysis request.
  if (hits >= 2) return true;
  // One cue on a non-trivial prompt.
  if (hits >= 1 && m.length >= 120) return true;
  return false;
}

export interface ModelChoice {
  model: string;
  escalated: boolean;
}

/**
 * Pick the model for a turn. An explicit per-request model always wins (no
 * escalation). Otherwise, when auto-escalation is enabled and the engine offers
 * a distinct escalation tier, analytical messages route to it.
 */
export function chooseModel(params: {
  explicit?: string | null;
  defaultModel: string;
  escalationModel: string;
  message: string;
  /** Override the process-level flag (used by tests). */
  autoEscalate?: boolean;
}): ModelChoice {
  const { explicit, defaultModel, escalationModel, message } = params;
  if (explicit) return { model: explicit, escalated: false };
  const enabled = params.autoEscalate ?? AUTO_ESCALATE;
  if (
    enabled &&
    escalationModel &&
    escalationModel !== defaultModel &&
    shouldEscalate(message)
  ) {
    return { model: escalationModel, escalated: true };
  }
  return { model: defaultModel, escalated: false };
}
