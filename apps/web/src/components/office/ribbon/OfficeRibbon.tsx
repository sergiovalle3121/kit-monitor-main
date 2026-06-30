'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, type LucideIcon } from 'lucide-react';
import { useOfficeChrome } from './OfficeChrome';

/**
 * Ribbon estilo Office, agnóstico del editor. Cada editor declara sus pestañas
 * con <RibbonTab> y, dentro, sus grupos con <RibbonGroup>. El OfficeRibbon:
 *  • dibuja la barra de pestañas (teclado ←/→, aria),
 *  • muestra sólo los grupos de la pestaña activa,
 *  • es colapsable (doble-clic en la pestaña o el chevron) y
 *  • desborda con scroll horizontal suave (degradados en los bordes) en pantallas angostas.
 *
 * Se "teletransporta" al host que publica el OfficeShell (debajo del header),
 * conservando su estado local porque el editor lo renderiza en una posición fija.
 */

export interface RibbonTabProps {
  id: string;
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

/** Marcador estructural: nunca se renderiza directamente; sus props las lee
 *  el OfficeRibbon. */
export const RibbonTab: React.FC<RibbonTabProps> = () => null;

type TabEl = React.ReactElement<RibbonTabProps>;
function isTab(node: React.ReactNode): node is TabEl {
  return React.isValidElement(node) && (node as React.ReactElement).type === RibbonTab;
}

export function OfficeRibbon({
  children, storageKey, defaultTab,
}: {
  children: React.ReactNode;
  /** Persiste pestaña activa y colapso por tipo de editor. */
  storageKey?: string;
  defaultTab?: string;
}) {
  const { ribbonHost } = useOfficeChrome();
  const tabs = useMemo(() => React.Children.toArray(children).filter(isTab) as TabEl[], [children]);

  const [active, setActive] = useState<string>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const v = window.localStorage.getItem(`${storageKey}:tab`);
      if (v) return v;
    }
    return defaultTab ?? tabs[0]?.props.id ?? '';
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && storageKey) return window.localStorage.getItem(`${storageKey}:collapsed`) === '1';
    return false;
  });

  // La pestaña efectiva se deriva en render (sin setState): si la activa ya no
  // existe porque cambió el set de pestañas, cae a la primera disponible.
  const activeTab = tabs.find((t) => t.props.id === active) ?? tabs[0];
  const activeId = activeTab?.props.id ?? '';

  useEffect(() => { if (storageKey && activeId) window.localStorage.setItem(`${storageKey}:tab`, activeId); }, [activeId, storageKey]);
  useEffect(() => { if (storageKey) window.localStorage.setItem(`${storageKey}:collapsed`, collapsed ? '1' : '0'); }, [collapsed, storageKey]);

  // Scroll horizontal con degradados de borde.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const updateEdges = () => {
    const el = scrollRef.current; if (!el) return;
    setEdges({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    updateEdges();
    const el = scrollRef.current; if (!el) return;
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId, collapsed]);

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.props.id === activeId);
    const ni = e.key === 'ArrowRight' ? Math.min(tabs.length - 1, i + 1) : Math.max(0, i - 1);
    setActive(tabs[ni].props.id);
  }

  const ui = (
    <div className="w-full bg-gray-50/90 dark:bg-[#0e0e0e]/90 backdrop-blur border-b border-black/[0.06] dark:border-white/10 select-none">
      {/* Barra de pestañas (desplazable en pantallas angostas / tablet) */}
      <div className="flex items-center px-2 pt-1">
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto ribbon-scroll" role="tablist" aria-label="Cinta de opciones" onKeyDown={onTabKey}>
          {tabs.map((t) => {
            const on = t.props.id === activeId;
            const Icon = t.props.icon;
            return (
              <button
                key={t.props.id} role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
                onClick={() => { setActive(t.props.id); if (collapsed) setCollapsed(false); }}
                onDoubleClick={() => setCollapsed((c) => !c)}
                className={`relative inline-flex items-center gap-1.5 px-3 h-8 text-[13px] rounded-t-lg transition-colors outline-none focus-visible:ring-2 ring-blue-500/40 flex-shrink-0 ${on ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium'}`}
              >
                {Icon && <Icon className="w-4 h-4" strokeWidth={1.75} />}
                {t.props.label}
                {on && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expandir la cinta' : 'Contraer la cinta'}
          aria-label={collapsed ? 'Expandir la cinta' : 'Contraer la cinta'}
          className="flex-shrink-0 ml-1 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Grupos de la pestaña activa */}
      {!collapsed && (
        <div className="relative" role="tabpanel">
          {edges.l && <span className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-gray-50 dark:from-[#0e0e0e] to-transparent" />}
          {edges.r && <span className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-gray-50 dark:from-[#0e0e0e] to-transparent" />}
          <div
            ref={scrollRef} onScroll={updateEdges}
            className="flex items-stretch gap-0 px-2 pb-1 overflow-x-auto overflow-y-hidden ribbon-scroll"
          >
            {activeTab?.props.children}
          </div>
        </div>
      )}
    </div>
  );

  if (ribbonHost) return createPortal(ui, ribbonHost);
  return ui; // fallback (host aún no disponible): se renderiza en sitio
}
