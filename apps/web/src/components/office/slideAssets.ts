/**
 * Temas y diseños de diapositiva (datos puros) para la profundidad «tipo
 * PowerPoint». El editor (Fabric) construye los objetos a partir de estos datos
 * usando el tema activo — sin dependencias nuevas.
 */

/** Opciones de transición de diapositiva y de animación de entrada (compartidas
 *  por el editor y el panel de animación; evita un import circular). */
export const SLIDE_TRANSITIONS: { label: string; value: string }[] = [
  { label: 'Sin transición', value: 'none' },
  { label: 'Fundido', value: 'fade' },
  { label: 'Deslizar', value: 'slide' },
  { label: 'Deslizar arriba', value: 'slideUp' },
  { label: 'Empujar', value: 'push' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Revelar', value: 'reveal' },
  { label: 'Voltear', value: 'flip' },
];
export const OBJ_ANIM_OPTIONS: { label: string; value: string }[] = [
  { label: 'Sin animación', value: 'none' },
  { label: 'Aparecer', value: 'fade' },
  { label: 'Entrar (abajo)', value: 'fly' },
  { label: 'Entrar (arriba)', value: 'flyDown' },
  { label: 'Entrar (izquierda)', value: 'flyLeft' },
  { label: 'Entrar (derecha)', value: 'flyRight' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Girar', value: 'rotate' },
  { label: 'Rebote', value: 'bounce' },
];

export interface SlideTheme {
  id: string; name: string;
  bg: string; surface: string; text: string; muted: string; accent: string; font: string;
}

export const SLIDE_THEMES: SlideTheme[] = [
  { id: 'light', name: 'Claro', bg: '#ffffff', surface: '#eef2ff', text: '#111827', muted: '#6b7280', accent: '#2563eb', font: 'sans-serif' },
  { id: 'midnight', name: 'Medianoche', bg: '#0f172a', surface: '#1e293b', text: '#f8fafc', muted: '#94a3b8', accent: '#38bdf8', font: 'sans-serif' },
  { id: 'warm', name: 'Cálido', bg: '#fffaf3', surface: '#ffedd5', text: '#7c2d12', muted: '#b45309', accent: '#ea580c', font: 'Georgia, serif' },
  { id: 'forest', name: 'Bosque', bg: '#f2fbf5', surface: '#dcfce7', text: '#14532d', muted: '#15803d', accent: '#16a34a', font: 'sans-serif' },
  { id: 'plum', name: 'Ciruela', bg: '#faf5ff', surface: '#f3e8ff', text: '#581c87', muted: '#7e22ce', accent: '#9333ea', font: 'sans-serif' },
  { id: 'mono', name: 'Mono', bg: '#fafafa', surface: '#e7e7e7', text: '#171717', muted: '#525252', accent: '#404040', font: 'ui-monospace, monospace' },
  { id: 'ocean', name: 'Océano', bg: '#f0f9ff', surface: '#e0f2fe', text: '#0c4a6e', muted: '#0369a1', accent: '#0ea5e9', font: 'sans-serif' },
  { id: 'slate', name: 'Pizarra', bg: '#f8fafc', surface: '#e2e8f0', text: '#0f172a', muted: '#475569', accent: '#475569', font: 'sans-serif' },
  { id: 'rose', name: 'Rosa', bg: '#fff1f2', surface: '#ffe4e6', text: '#881337', muted: '#be123c', accent: '#e11d48', font: 'Georgia, serif' },
  { id: 'sand', name: 'Arena', bg: '#fefce8', surface: '#fef9c3', text: '#713f12', muted: '#a16207', accent: '#ca8a04', font: 'sans-serif' },
  { id: 'graphite', name: 'Grafito', bg: '#111827', surface: '#1f2937', text: '#f9fafb', muted: '#9ca3af', accent: '#f472b6', font: 'sans-serif' },
  { id: 'emerald', name: 'Esmeralda', bg: '#022c22', surface: '#064e3b', text: '#ecfdf5', muted: '#6ee7b7', accent: '#34d399', font: 'sans-serif' },
];

export type PlaceKind = 'title' | 'subtitle' | 'body' | 'bar' | 'accentBar';
export interface Placeholder {
  kind: PlaceKind;
  text?: string;
  left: number; top: number; width: number; height?: number;
  fontSize?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; muted?: boolean;
}

export interface SlideLayout { id: string; name: string; build: () => Placeholder[] }

export const SLIDE_LAYOUTS: SlideLayout[] = [
  {
    id: 'title', name: 'Portada',
    build: () => [
      { kind: 'bar', left: 0, top: 478, width: 960, height: 62 },
      { kind: 'title', text: 'Título de la presentación', left: 100, top: 195, width: 760, fontSize: 54, bold: true, align: 'center' },
      { kind: 'subtitle', text: 'Subtítulo · Autor', left: 100, top: 285, width: 760, fontSize: 26, align: 'center', muted: true },
    ],
  },
  {
    id: 'titleBody', name: 'Título y contenido',
    build: () => [
      { kind: 'accentBar', left: 56, top: 64, width: 90, height: 8 },
      { kind: 'title', text: 'Título', left: 56, top: 80, width: 840, fontSize: 40, bold: true },
      { kind: 'body', text: '• Punto uno\n• Punto dos\n• Punto tres', left: 56, top: 170, width: 840, fontSize: 26 },
    ],
  },
  {
    id: 'twoContent', name: 'Dos contenidos',
    build: () => [
      { kind: 'title', text: 'Título', left: 56, top: 64, width: 840, fontSize: 40, bold: true },
      { kind: 'body', text: '• Columna izquierda', left: 56, top: 170, width: 400, fontSize: 24 },
      { kind: 'body', text: '• Columna derecha', left: 504, top: 170, width: 400, fontSize: 24 },
    ],
  },
  {
    id: 'section', name: 'Encabezado de sección',
    build: () => [
      { kind: 'accentBar', left: 80, top: 250, width: 120, height: 10 },
      { kind: 'title', text: 'Sección', left: 80, top: 270, width: 800, fontSize: 52, bold: true },
      { kind: 'subtitle', text: 'Descripción breve de la sección', left: 80, top: 360, width: 800, fontSize: 24, muted: true },
    ],
  },
  {
    id: 'blank', name: 'En blanco', build: () => [],
  },
];
