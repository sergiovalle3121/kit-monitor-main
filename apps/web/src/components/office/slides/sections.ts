/**
 * **Secciones del mazo** (como PowerPoint): un arreglo `sections` paralelo a las diapositivas, donde
 * `sections[i]` es el **nombre** de la sección que **empieza** en la diapositiva `i` (o `null` si esa
 * diapositiva continúa la sección anterior). Estas utilidades son **puras** (no tocan el DOM ni el
 * lienzo), así que se prueban de forma aislada; la UI las usa para agrupar/renombrar/quitar.
 */

export interface SectionGroup { title: string | null; start: number; slides: number[] }

/** Normaliza un valor de sección: cadena no vacía recortada, o `null`. */
function norm(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
}

/**
 * Agrupa los índices `0..count-1` por sección. Un nombre no nulo en `sections[i]` inicia una sección;
 * las diapositivas anteriores a la primera sección con nombre forman un grupo de `title: null`.
 */
export function groupSlidesBySection(count: number, sections: (string | null)[] = []): SectionGroup[] {
  const groups: SectionGroup[] = [];
  for (let i = 0; i < count; i++) {
    const name = norm(sections[i]);
    if (groups.length === 0 || name != null) groups.push({ title: i === 0 ? name : name, start: i, slides: [i] });
    else groups[groups.length - 1].slides.push(i);
  }
  return groups;
}

/** Nombre de la sección **activa** en la diapositiva `i` (el nombre no nulo más reciente en `i` o antes). */
export function sectionTitleAt(sections: (string | null)[], i: number): string | null {
  for (let k = Math.min(i, sections.length - 1); k >= 0; k--) { const n = norm(sections[k]); if (n != null) return n; }
  return null;
}

/** ¿La diapositiva `i` **inicia** una sección con nombre? */
export function isSectionStart(sections: (string | null)[], i: number): boolean {
  return norm(sections[i]) != null;
}

/** Devuelve una copia de `sections` (longitud ≥ `count`) con `at` puesto a `name` (o limpiado). */
export function setSectionAt(sections: (string | null)[], at: number, name: string | null, count?: number): (string | null)[] {
  const len = Math.max(count ?? 0, sections.length, at + 1);
  const out: (string | null)[] = [];
  for (let i = 0; i < len; i++) out.push(i === at ? norm(name) : (sections[i] ?? null));
  return out;
}

/** Quita la sección que **inicia** en `at` (la diapositiva pasa a continuar la sección anterior). */
export function removeSectionAt(sections: (string | null)[], at: number): (string | null)[] {
  return setSectionAt(sections, at, null);
}

/** Cuenta de secciones con nombre. */
export function sectionCount(sections: (string | null)[] = []): number {
  return sections.reduce((n, v) => n + (norm(v) != null ? 1 : 0), 0);
}
