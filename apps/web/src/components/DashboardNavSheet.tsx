"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Home, MessageSquare, Settings, X } from "lucide-react";
import { isAdminAccess, seesAllAreas } from "@/lib/owner";
import { navSections, type DashboardArea } from "@/lib/dashboardAreas";
import { ICON_STROKE } from "@/lib/design/domains";
import { useDashboardSession } from "@/hooks/useDashboardSession";

/**
 * Panel de navegación móvil — el equivalente del Command rail para pantallas
 * pequeñas (donde el rail va oculto). Como el home ya no muestra la rejilla de
 * módulos, ESTE panel garantiza que TODO módulo siga alcanzable navegando (no
 * solo desde el buscador): es la "única casa" de la navegación, también en móvil.
 *
 * Se abre con el evento global `axos:open-nav` (botón de menú en la barra
 * superior) y se cierra con Esc, tocando el backdrop o al cambiar de ruta.
 */
export function DashboardNavSheet() {
  const pathname = usePathname() || "";
  const { session } = useDashboardSession();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || "";

  const sections = useMemo(() => navSections(role, seesAll), [role, seesAll]);

  // Abrir vía evento global (mismo patrón que la paleta de búsqueda).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("axos:open-nav", onOpen);
    return () => window.removeEventListener("axos:open-nav", onOpen);
  }, []);

  // Cerrar con Esc + bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const active = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] lg:hidden" role="dialog" aria-modal="true" aria-label="Navegación">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col border-r border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-foreground text-[13px] font-semibold text-background">
                AX
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  Navegación
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Dominios AXOS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar navegación"
                className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
              <SheetItem href="/dashboard" label="Inicio" icon={Home} active={active("/dashboard")} onNavigate={() => setOpen(false)} />
              <SheetItem
                href="/dashboard/chat"
                label="Mensajes"
                icon={MessageSquare}
                active={active("/dashboard/chat")}
                onNavigate={() => setOpen(false)}
              />

              <div className="mt-3 space-y-4">
                {sections.map(({ section, areas }) => (
                  <section key={section} aria-label={section}>
                    <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {section}
                    </h2>
                    <div className="space-y-0.5">
                      {areas.map((area) => (
                        <SheetArea key={area.href} area={area} active={active(area.href)} onNavigate={() => setOpen(false)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {isAdmin && (
                <div className="mt-4 border-t border-border/70 pt-3">
                  <SheetItem
                    href="/dashboard/settings/organization"
                    label="Ajustes"
                    icon={Settings}
                    active={active("/dashboard/settings")}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              )}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetArea({ area, active, onNavigate }: { area: DashboardArea; active: boolean; onNavigate: () => void }) {
  const Icon = area.icon;
  return (
    <Link
      href={area.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      }`}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={ICON_STROKE} />
      <span className="block min-w-0 flex-1 truncate text-sm font-medium">{area.name}</span>
    </Link>
  );
}

function SheetItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      }`}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={ICON_STROKE} />
      <span className="truncate text-sm font-medium">{label}</span>
    </Link>
  );
}
