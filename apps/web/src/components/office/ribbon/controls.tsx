'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';

/**
 * Controles compartidos del ribbon de Office (estilo Apple / glass, dark mode,
 * accesibles). Son agnósticos del editor: sólo reciben handlers y estado, y los
 * editores (Docs / Hojas / Slides) los componen en pestañas y grupos.
 */

// ── Tooltip + atajo ────────────────────────────────────────────────────────
function tip(label: string, shortcut?: string) {
  return shortcut ? `${label} (${shortcut})` : label;
}

// ── Popover genérico (click-fuera + Esc) ─────────────────────────────────────
export function Popover({
  open, onClose, children, align = 'left', width,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <span className="fixed inset-0 z-[55]" onMouseDown={onClose} />
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute top-full mt-1 z-[60] rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1b1b1d]/95 backdrop-blur-xl shadow-2xl p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{ width }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Botón ────────────────────────────────────────────────────────────────────
export function RibbonButton({
  icon: Icon, label, onClick, active, disabled, shortcut, danger, big, hideLabel = true,
}: {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
  /** Botón prominente: ícono arriba + etiqueta debajo (estilo "Pegar"). */
  big?: boolean;
  /** En botones pequeños, oculta el texto y deja sólo el ícono (default). */
  hideLabel?: boolean;
}) {
  const base = 'inline-flex items-center justify-center select-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 ring-blue-500/50';
  const tone = active
    ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
    : danger
      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
      : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/10';

  if (big) {
    return (
      <button
        type="button" title={tip(label, shortcut)} aria-label={label} aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
        className={`${base} ${tone} flex-col gap-1 h-[58px] min-w-[52px] px-2 rounded-xl text-[11px] font-medium`}
      >
        {Icon && <Icon className="w-5 h-5" strokeWidth={1.75} />}
        <span className="leading-none">{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button" title={tip(label, shortcut)} aria-label={label} aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      className={`${base} ${tone} h-7 ${hideLabel ? 'w-7' : 'gap-1.5 px-2 text-xs font-medium'} rounded-lg`}
    >
      {Icon && <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />}
      {!hideLabel && <span>{label}</span>}
    </button>
  );
}

// ── Select estilizado (fuente, tamaño, estilo de párrafo…) ────────────────────
export function RibbonSelect({
  value, onChange, title, options, width = 120, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  options: { label: string; value: string; style?: React.CSSProperties }[];
  width?: number;
  placeholder?: string;
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        title={title} aria-label={title} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
        className="h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/10 border border-transparent focus:border-blue-500/40 pl-2 pr-6 outline-none cursor-pointer appearance-none text-foreground truncate"
      >
        {placeholder && <option value="" disabled hidden>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value || o.label} value={o.value} style={o.style}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-1.5 pointer-events-none text-gray-400" />
    </span>
  );
}

// ── Botón de color (con popover de muestras + personalizado) ──────────────────
const SWATCHES = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#efefef', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#8e7cc3', '#c27ba0',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#674ea7', '#a64d79',
];

export function RibbonColorButton({
  icon: Icon, title, value, onChange, onClear, clearLabel, swatchBar = true,
}: {
  icon: LucideIcon;
  title: string;
  value?: string;
  onChange: (color: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  /** Muestra una barra de color bajo el ícono (resaltado/texto). */
  swatchBar?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const last = value || '#000000';
  return (
    <span className="relative inline-flex">
      <button
        type="button" title={title} aria-label={title} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
        className="h-7 px-1 inline-flex flex-col items-center justify-center gap-0.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/10 outline-none focus-visible:ring-2 ring-blue-500/50"
      >
        <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />
        {swatchBar && <span className="w-4 h-[3px] rounded-full" style={{ background: last }} />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={200}>
        {onClear && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onClear(); setOpen(false); }}
            className="w-full mb-1 flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="w-4 h-4 rounded border border-gray-300 bg-white relative overflow-hidden">
              <span className="absolute inset-0 rotate-45 border-t border-red-500 top-1/2" />
            </span>
            {clearLabel || 'Sin color'}
          </button>
        )}
        <div className="grid grid-cols-8 gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c} type="button" title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-5 h-5 rounded-md border transition-transform hover:scale-110 ${value?.toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500' : 'border-black/10 dark:border-white/15'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
          <span className="w-4 h-4 rounded border border-gray-300" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }} />
          Personalizado…
          <input
            type="color" defaultValue={last}
            onChange={(e) => { onChange(e.target.value); }}
            className="ml-auto w-6 h-6 rounded cursor-pointer bg-transparent"
          />
        </label>
      </Popover>
    </span>
  );
}

// ── Split button (acción principal + menú) ────────────────────────────────────
export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  hint?: string;
}

export function RibbonSplitButton({
  icon: Icon, label, onClick, items, big, disabled, menuWidth = 200,
}: {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;       // acción del lado principal (opcional)
  items: MenuItem[];
  big?: boolean;
  disabled?: boolean;
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasMain = typeof onClick === 'function';

  return (
    <span className="relative inline-flex">
      <span className={`inline-flex items-stretch rounded-lg overflow-hidden ${big ? '' : 'h-7'}`}>
        {hasMain && (
          <button
            type="button" title={label} aria-label={label} disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={onClick}
            className={`inline-flex items-center justify-center gap-1.5 transition-colors text-gray-700 dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/10 disabled:opacity-40 ${big ? 'flex-col h-[58px] min-w-[52px] px-2 text-[11px] font-medium rounded-l-xl' : 'h-7 px-2 text-xs font-medium'}`}
          >
            {Icon && <Icon className={big ? 'w-5 h-5' : 'w-[17px] h-[17px]'} strokeWidth={1.75} />}
            <span className={big ? 'leading-none' : ''}>{label}</span>
          </button>
        )}
        <button
          type="button" title={hasMain ? `${label} — más opciones` : label}
          aria-label={hasMain ? `${label} — más opciones` : label} aria-haspopup="menu" aria-expanded={open}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center justify-center transition-colors text-gray-700 dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/10 disabled:opacity-40 ${big ? 'flex-col h-[58px] px-1.5 rounded-r-xl text-[11px]' : 'h-7 px-1 rounded-lg'} ${hasMain ? 'border-l border-black/5 dark:border-white/10' : (big ? '' : 'gap-1.5 px-2')}`}
        >
          {!hasMain && (big
            ? <span className="flex flex-col items-center gap-1">{Icon && <Icon className="w-5 h-5" strokeWidth={1.75} />}<span className="leading-none">{label}</span></span>
            : <span className="inline-flex items-center gap-1.5 text-xs font-medium">{Icon && <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />}{label}</span>)}
          <ChevronDown className={`w-3 h-3 ${big ? 'mt-0.5' : ''}`} />
        </button>
      </span>
      <Popover open={open} onClose={() => setOpen(false)} width={menuWidth}>
        <RibbonMenuList items={items} onPick={() => setOpen(false)} />
      </Popover>
    </span>
  );
}

export function RibbonMenuList({ items, onPick }: { items: MenuItem[]; onPick?: () => void }) {
  return (
    <div className="flex flex-col">
      {items.map((it, i) => (
        <button
          key={i} type="button" role="menuitem"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { it.onClick(); onPick?.(); }}
          className={`w-full flex items-center gap-2.5 text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${it.danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'hover:bg-black/5 dark:hover:bg-white/10'} ${it.active ? 'font-semibold' : ''}`}
        >
          {it.icon && <it.icon className="w-4 h-4 flex-shrink-0 opacity-80" strokeWidth={1.75} />}
          <span className="flex-1 truncate">{it.label}</span>
          {it.hint && <kbd className="text-[10px] font-mono text-gray-400">{it.hint}</kbd>}
        </button>
      ))}
    </div>
  );
}

// ── Menú genérico desplegable (trigger libre) ────────────────────────────────
export function RibbonMenuButton({
  icon: Icon, label, items, big, menuWidth = 220, children,
}: {
  icon?: LucideIcon;
  label: string;
  items?: MenuItem[];
  big?: boolean;
  menuWidth?: number;
  children?: React.ReactNode; // contenido libre del popover (galerías)
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center justify-center transition-colors text-gray-700 dark:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/10 outline-none focus-visible:ring-2 ring-blue-500/50 ${big ? 'flex-col gap-1 h-[58px] min-w-[52px] px-2 rounded-xl text-[11px] font-medium' : 'h-7 gap-1.5 px-2 rounded-lg text-xs font-medium'}`}
      >
        {Icon && <Icon className={big ? 'w-5 h-5' : 'w-[17px] h-[17px]'} strokeWidth={1.75} />}
        <span className={big ? 'leading-none' : ''}>{label}</span>
        <ChevronDown className={`w-3 h-3 ${big ? 'mt-0.5' : ''}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width={menuWidth}>
        {children ? (
          <div onClick={() => setOpen(false)}>{children}</div>
        ) : items ? (
          <RibbonMenuList items={items} onPick={() => setOpen(false)} />
        ) : null}
      </Popover>
    </span>
  );
}

// ── Grupo + separador ────────────────────────────────────────────────────────
export function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-shrink-0 px-1.5">
      <div className="flex items-center gap-0.5 min-h-[48px] py-1">{children}</div>
      <div className="text-[10px] leading-none text-gray-400 dark:text-gray-500 pb-1 text-center truncate">
        {label}
      </div>
    </div>
  );
}

export function RibbonSeparator() {
  return <span className="w-px self-stretch my-2 bg-black/[0.07] dark:bg-white/10 flex-shrink-0" />;
}

/** Pila vertical de controles dentro de un grupo (para empaquetar 2-3 filas). */
export function RibbonStack({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex flex-col gap-0.5">{children}</span>;
}

/** Fila horizontal de controles dentro de un grupo. */
export function RibbonRow({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-0.5">{children}</span>;
}
