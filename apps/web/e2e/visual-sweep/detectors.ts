/**
 * Detectores DOM del barrido visual. `domDetectors` se serializa y corre DENTRO
 * de la página (page.evaluate), por eso es 100% autocontenida: no referencia
 * nada del módulo. Devuelve hallazgos con severidad para `visual-findings.json`.
 *
 * Cubre exactamente los síntomas del owner:
 *  - overflow horizontal (scrollWidth > clientWidth),
 *  - texto invisible (color ≈ fondo),
 *  - botones de cerrar fuera del viewport o de tamaño 0,
 *  - solapamiento de elementos interactivos,
 *  - overlays/dropdowns sin fondo opaco sobre texto.
 *
 * (El contraste WCAG AA "normal" lo aporta axe-core en el spec; aquí marcamos el
 *  caso extremo de invisibilidad, más severo y barato de detectar.)
 */

export type Severity = 'high' | 'medium' | 'low';

export interface DomFinding {
  type:
    | 'horizontal-overflow'
    | 'invisible-text'
    | 'close-button-offscreen'
    | 'overlap-interactive'
    | 'transparent-overlay';
  severity: Severity;
  message: string;
  selector: string;
  rect?: { x: number; y: number; w: number; h: number };
}

/** Función que corre en el navegador. */
export function domDetectors(vp: { w: number; h: number }): DomFinding[] {
  const findings: DomFinding[] = [];
  const MARGIN = 1;

  const selectorOf = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
    const tid = el.getAttribute('data-testid');
    return `${tag}${id}${cls}${tid ? `[data-testid="${tid}"]` : ''}`.slice(0, 160);
  };

  // Parser de color robusto vía canvas: el navegador resuelve CUALQUIER sintaxis
  // CSS (rgb/rgba/hsl/oklch/oklab/color()/named). Imprescindible porque Tailwind
  // v4 serializa la paleta en `oklch(...)`, que un regex `rgba()` no entiende
  // (eso producía falsos "texto invisible" de botones con fondo oklch).
  const _cv = document.createElement('canvas');
  _cv.width = _cv.height = 1;
  const _cx = _cv.getContext('2d', { willReadFrequently: true });
  const parseColor = (c: string): { r: number; g: number; b: number; a: number } | null => {
    if (!c || !_cx) return null;
    try {
      _cx.clearRect(0, 0, 1, 1);
      _cx.fillStyle = 'rgba(0,0,0,0)';
      _cx.fillStyle = c; // si `c` es inválido, fillStyle queda en el valor previo (transparente)
      _cx.fillRect(0, 0, 1, 1);
      const d = _cx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    } catch {
      return null;
    }
  };

  // ¿Hay un background-image (gradiente/imagen) entre el texto y el primer fondo
  // opaco? Si sí, el contraste real no se puede medir por color sólido → no marcar.
  const hasBackingImage = (el: Element): boolean => {
    let node: Element | null = el;
    while (node) {
      const s = getComputedStyle(node);
      if (s.backgroundImage && s.backgroundImage !== 'none') return true;
      const c = parseColor(s.backgroundColor);
      if (c && c.a >= 0.95) return false;
      node = node.parentElement;
    }
    return false;
  };

  const lum = (r: number, g: number, b: number): number => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const contrast = (
    fg: { r: number; g: number; b: number },
    bg: { r: number; g: number; b: number },
  ): number => {
    const l1 = lum(fg.r, fg.g, fg.b);
    const l2 = lum(bg.r, bg.g, bg.b);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };

  // Fondo efectivo: primer ancestro con color de fondo opaco.
  const effectiveBg = (el: Element): { r: number; g: number; b: number } => {
    let node: Element | null = el;
    while (node) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.95) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255 };
  };

  const isVisible = (el: Element): boolean => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const hasDirectText = (el: Element): boolean => {
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0) return true;
    }
    return false;
  };

  // Texto con gradiente recortado (background-clip:text + text-fill-color
  // transparent) es VISIBLE vía el gradiente — no es texto invisible.
  const isClippedGradientText = (cs: CSSStyleDeclaration): boolean => {
    const clip = cs.backgroundClip || (cs as unknown as { webkitBackgroundClip?: string }).webkitBackgroundClip;
    return clip === 'text' && cs.backgroundImage !== 'none';
  };

  const positionOf = (el: Element): string => getComputedStyle(el).position;

  // ── 1) Overflow horizontal (nivel página) ───────────────────────────────
  try {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    if (over > 4) {
      findings.push({
        type: 'horizontal-overflow',
        severity: 'medium',
        message: `La página desborda ${over}px en horizontal (scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth}).`,
        selector: 'html',
      });
    }
  } catch {
    /* noop */
  }

  // ── 2) Texto invisible (color ≈ fondo) ───────────────────────────────────
  try {
    const all = Array.from(document.querySelectorAll('body *')).slice(0, 4000);
    let reported = 0;
    for (const el of all) {
      if (reported >= 25) break;
      if (!hasDirectText(el) || !isVisible(el)) continue;
      const cs = getComputedStyle(el);
      if (isClippedGradientText(cs)) continue; // gradiente recortado = visible
      if (hasBackingImage(el)) continue; // fondo con gradiente/imagen: contraste no medible
      const fg = parseColor(cs.color);
      if (!fg) continue;
      if (fg.a < 0.1) {
        findings.push({
          type: 'invisible-text',
          severity: 'high',
          message: `Texto con color casi transparente (alfa ${fg.a.toFixed(2)}): "${(el.textContent ?? '').trim().slice(0, 40)}".`,
          selector: selectorOf(el),
        });
        reported++;
        continue;
      }
      const bg = effectiveBg(el);
      const ratio = contrast(fg, bg);
      if (ratio < 1.3) {
        const r = el.getBoundingClientRect();
        findings.push({
          type: 'invisible-text',
          severity: 'high',
          message: `Texto casi invisible: contraste ${ratio.toFixed(2)}:1 (color≈fondo). "${(el.textContent ?? '').trim().slice(0, 40)}".`,
          selector: selectorOf(el),
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        });
        reported++;
      }
    }
  } catch {
    /* noop */
  }

  // ── 3) Botones de cerrar fuera del viewport o de tamaño 0 ────────────────
  try {
    const candidates = Array.from(
      document.querySelectorAll(
        '[aria-label*="cerrar" i], [aria-label*="close" i], [data-testid*="close" i], button:has(svg.lucide-x)',
      ),
    ).slice(0, 50);
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      const zeroSize = r.width < 2 || r.height < 2;
      const offViewport =
        r.right <= MARGIN || r.bottom <= MARGIN || r.left >= vp.w - MARGIN || r.top >= vp.h - MARGIN;
      if (zeroSize || offViewport) {
        findings.push({
          type: 'close-button-offscreen',
          severity: 'high',
          message: zeroSize
            ? `Botón de cerrar con tamaño ~0 (${Math.round(r.width)}×${Math.round(r.height)}).`
            : `Botón de cerrar fuera del viewport (x:${Math.round(r.x)}, y:${Math.round(r.y)}, vp ${vp.w}×${vp.h}).`,
          selector: selectorOf(el),
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        });
      }
    }
  } catch {
    /* noop */
  }

  // ── 4) Solapamiento de elementos interactivos ────────────────────────────
  try {
    const interactives = Array.from(
      document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [role="button"]'),
    )
      .filter((el) => isVisible(el))
      .slice(0, 160);
    const rects = interactives.map((el) => ({ el, r: el.getBoundingClientRect() }));
    let reported = 0;
    for (let i = 0; i < rects.length && reported < 15; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // Ignora UI flotante intencional (dock/chat/asistente): si alguno está
        // fixed/sticky, el solape es por diseño (capa superior), no un descuadre.
        const pa = positionOf(a.el);
        const pb = positionOf(b.el);
        if (pa === 'fixed' || pa === 'sticky' || pb === 'fixed' || pb === 'sticky') continue;
        const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
        const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
        const inter = ix * iy;
        if (inter <= 0) continue;
        const minArea = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (minArea > 0 && inter / minArea > 0.6) {
          findings.push({
            type: 'overlap-interactive',
            severity: 'medium',
            message: `Dos controles interactivos se solapan ${Math.round((inter / minArea) * 100)}%: ${selectorOf(a.el)} ⟂ ${selectorOf(b.el)}.`,
            selector: selectorOf(a.el),
          });
          reported++;
          break;
        }
      }
    }
  } catch {
    /* noop */
  }

  // ── 5) Overlays/dropdowns sin fondo opaco ────────────────────────────────
  try {
    const overlays = Array.from(
      document.querySelectorAll(
        '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [class*="dropdown" i], [class*="popover" i]',
      ),
    ).slice(0, 40);
    for (const el of overlays) {
      if (!isVisible(el)) continue;
      const bg = parseColor(getComputedStyle(el).backgroundColor);
      // Sólo es problema si el panel es traslúcido Y tapa texto detrás.
      if (bg && bg.a < 0.85) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const stack = document.elementsFromPoint(cx, cy);
        const behindText = stack
          .slice(stack.indexOf(el) + 1)
          .some((b) => hasDirectText(b) && (b.textContent ?? '').trim().length > 0);
        if (behindText) {
          findings.push({
            type: 'transparent-overlay',
            severity: 'high',
            message: `Overlay/dropdown con fondo traslúcido (alfa ${bg.a.toFixed(2)}) que deja ver texto detrás.`,
            selector: selectorOf(el),
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          });
        }
      }
    }
  } catch {
    /* noop */
  }

  return findings;
}
