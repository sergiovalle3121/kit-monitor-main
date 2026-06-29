/**
 * Visual-sweep library — shared config, route discovery, DOM detectors and the
 * findings writer for the systematic look-&-feel sweep (see visual-sweep.spec.ts).
 *
 * The sweep walks every static app route in two viewports (desktop 1440 / mobile
 * 390) and both themes (light / dark), screenshots each, and runs DOM detectors
 * + axe-core to surface the kinds of regressions a human reviewer would catch:
 * horizontal overflow, controls clipped off-viewport, translucent overlays that
 * read through, invisible text and low contrast.
 *
 * It is hermetic: it reuses the golden-suite fixtures (forged owner session +
 * in-memory mock backend), so no live API/DB is needed.
 */
import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

export interface Viewport {
  name: "desktop" | "mobile";
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type Severity = "high" | "medium" | "low";

export interface Finding {
  type: string;
  severity: Severity;
  detail: string;
  selector?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

export interface RouteResult {
  route: string;
  viewport: string;
  theme: Theme;
  screenshot: string;
  findings: Finding[];
  error?: string;
}

const APP_DIR = join(process.cwd(), "src", "app");

/**
 * Discover every *static* page route under src/app (skipping dynamic [param]
 * segments and route groups). Dynamic detail pages need fixture ids and are
 * swept separately/manually; the static set is the bulk of the look-&-feel.
 */
export function discoverRoutes(): string[] {
  const routes: string[] = [];
  const walk = (dir: string, segments: string[]) => {
    let entries: Dirent[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }
    const hasPage = entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name));
    if (hasPage) {
      const path = "/" + segments.filter(Boolean).join("/");
      routes.push(path === "/" ? "/" : path);
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      // Skip API routes, private folders, dynamic params and parallel/intercept routes.
      if (e.name === "api") continue;
      if (e.name.startsWith("_")) continue;
      if (e.name.startsWith("[")) continue; // dynamic route — needs fixture id
      if (e.name.startsWith("(") && e.name.endsWith(")")) {
        walk(join(dir, e.name), segments); // route group: no URL segment
        continue;
      }
      if (e.name.startsWith("@")) continue; // parallel route slot
      walk(join(dir, e.name), [...segments, e.name]);
    }
  };
  walk(APP_DIR, []);
  // Stable, readable order.
  return Array.from(new Set(routes)).sort();
}

/** Filesystem-safe slug for a route. */
export function slugForRoute(route: string): string {
  const s = route.replace(/^\//, "").replace(/\//g, "__");
  return s === "" ? "root" : s;
}

/**
 * Browser-side DOM detectors. Serialized and run via page.evaluate, so it must
 * be a self-contained function with no external references. Returns findings.
 */
export function domDetectors(): Finding[] {
  const out: Finding[] = [];
  const W = window.innerWidth;
  const H = window.innerHeight;

  const sel = (el: Element): string => {
    const id = (el as HTMLElement).id;
    if (id) return `#${id}`;
    const cls = (el.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    const aria = el.getAttribute("aria-label");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${aria ? `[aria-label="${aria.slice(0, 24)}"]` : ""}`;
  };
  const rectOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };
  // Alpha of a CSS color string (1 if opaque/unknown, 0 for transparent). We do
  // NOT compute WCAG contrast here — headless canvas readback is flaky and
  // produced bogus "near-invisible" findings; axe-core owns color-contrast (it is
  // the authoritative source and handles lab()/oklch()). Our detectors cover what
  // axe does not: overflow, trapped exits, translucent overlays, transparent text.
  const alphaOf = (c: string): number => {
    if (!c || c === "transparent") return 0;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1; // lab()/oklch()/named → assume opaque
    const p = m[1].split(/[,/ ]+/).filter(Boolean);
    return p[3] === undefined ? 1 : parseFloat(p[3]);
  };

  // 1) Horizontal overflow — page wider than the viewport.
  if (document.documentElement.scrollWidth > W + 2) {
    const offenders: Element[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= W + 2 && r.right > W + 4 && r.width > 24 && r.height > 8) {
        // Only flag if no ancestor is itself overflowing (the innermost cause).
        offenders.push(el);
      }
    });
    out.push({
      type: "horizontal-overflow",
      severity: "high",
      detail: `Document scrollWidth ${document.documentElement.scrollWidth}px > viewport ${W}px. ${offenders.length} element(s) extend past the right edge.`,
      selector: offenders[0] ? sel(offenders[0]) : "html",
      rect: offenders[0] ? rectOf(offenders[0]) : undefined,
    });
  }

  // 2) Off-viewport / clipped close & exit controls (the "trap" detector).
  // Word-boundaried so "Backflush" doesn't match "back". A control that is merely
  // below the fold is reachable by scrolling — only HORIZONTAL clipping (e.g. a
  // dense non-wrapping toolbar) or a FIXED control pushed off-screen is a trap.
  const exitRe = /\b(cerrar|close|salir|exit|volver|atr[áa]s|back)\b/i;
  document.querySelectorAll<HTMLElement>("button, a, [role='button']").forEach((el) => {
    const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
    if (label.length > 40 || !exitRe.test(label)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    const pinned = cs.position === "fixed" || cs.position === "sticky";
    const clippedRight = r.right > W + 2;
    const offLeft = r.right < 2;
    const offTopFixed = pinned && r.bottom < 2;
    const offBottomFixed = pinned && r.top > H - 2;
    if (clippedRight || offLeft || offTopFixed || offBottomFixed) {
      out.push({
        type: "offscreen-exit-control",
        severity: "high",
        detail: `Exit/close control "${label.slice(0, 40)}" is outside the viewport (${clippedRight ? "clipped right" : offLeft ? "off left" : offTopFixed ? "above" : "below"}). The user could be trapped.`,
        selector: sel(el),
        rect: rectOf(el),
      });
    }
  });

  // 3) Translucent floating overlays (menus/popovers/dialogs that read through).
  document
    .querySelectorAll<HTMLElement>("[role='menu'], [role='listbox'], [role='dialog'], [data-radix-popper-content-wrapper]")
    .forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") return;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24) return;
      const a = alphaOf(cs.backgroundColor);
      const transparentSelf = a < 0.85;
      // A menu whose OWN background is see-through and that isn't a full-screen
      // backdrop is the breadcrumb-style "reads through onto cards" bug.
      const looksLikeBackdrop = r.width >= W * 0.95 && r.height >= H * 0.95;
      if (transparentSelf && !looksLikeBackdrop) {
        out.push({
          type: "translucent-overlay",
          severity: "high",
          detail: `Floating ${el.getAttribute("role") || "overlay"} has a translucent background (alpha ${a.toFixed(2)}); content behind it shows through. Use an opaque popover surface + portal.`,
          selector: sel(el),
          rect: rectOf(el),
        });
      }
    });

  // 4) Truly-invisible text — a transparent text color that is NOT a
  // gradient-text clip (background-clip:text) and NOT opacity:0 (scroll reveal).
  // Contrast/AA is left to axe-core (color-contrast) to avoid headless flakiness.
  const seen = new Set<Element>();
  document.querySelectorAll<HTMLElement>("p, span, a, h1, h2, h3, h4, li, td, th, button, label").forEach((el) => {
    if (seen.has(el)) return;
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent || "")
      .join("")
      .trim();
    if (text.length < 2) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    if (parseFloat(cs.opacity) === 0) return; // animation/reveal
    const clip = cs.webkitBackgroundClip || (cs as unknown as { backgroundClip?: string }).backgroundClip;
    if (clip === "text") return; // gradient text
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    seen.add(el);
    if (alphaOf(cs.color) === 0) {
      out.push({ type: "invisible-text", severity: "high", detail: `Text "${text.slice(0, 30)}" has a fully transparent color.`, selector: sel(el), rect: rectOf(el) });
    }
  });

  return out;
}
