"use client";

import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Home, MessageSquare, Settings, X } from "lucide-react";
import { isAdminAccess, seesAllAreas } from "@/lib/owner";
import { navSections, type DashboardArea } from "@/lib/dashboardAreas";
import { ICON_STROKE } from "@/lib/design/domains";
import { useDashboardSession } from "@/hooks/useDashboardSession";
import { useNavOpen, setNavOpen } from "@/lib/navDrawer";

/**
 * Cajón de navegación (sidebar) ÚNICO para todos los tamaños. El contenido vive a
 * pantalla completa; este cajón aparece solo cuando lo pides desde el botón
 * "Axos OS" de la barra superior (toggle) y se cierra con la X, el backdrop, Esc
 * o volviendo a tocar "Axos OS". Se posiciona DEBAJO de la barra superior para que
 * el botón "Axos OS" siga visible y sirva de toggle.
 */
export function DashboardNavSheet() {
  const pathname = usePathname() || "";
  const { session } = useDashboardSession();
  const reduce = useReducedMotion();
  const open = useNavOpen();

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const seesAll = seesAllAreas(session?.role, session?.email);
  const role = session?.role || "";

  const sections = useMemo(() => navSections(role, seesAll), [role, seesAll]);

  const close = () => setNavOpen(false);

  // Cerrar con Esc + bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
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
        <div className="fixed inset-x-0 bottom-0 top-16 z-[55]" role="dialog" aria-modal="true" aria-label="Navegación">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={close}
          />
          <motion.aside
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 flex w-[86vw] max-w-xs flex-col border-r border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
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
                onClick={close}
                aria-label="Cerrar navegación"
                className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
              <SheetItem href="/dashboard" label="Inicio" icon={Home} active={active("/dashboard")} onNavigate={close} />
              <SheetItem
                href="/dashboard/chat"
                label="Mensajes"
                icon={MessageSquare}
                active={active("/dashboard/chat")}
                onNavigate={close}
              />

              <div className="mt-3 space-y-4">
                {sections.map(({ section, areas }) => (
                  <section key={section} aria-label={section}>
                    <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {section}
                    </h2>
                    <div className="space-y-0.5">
                      {areas.map((area) => (
                        <SheetArea key={area.href} area={area} active={active(area.href)} onNavigate={close} />
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
                    onNavigate={close}
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
