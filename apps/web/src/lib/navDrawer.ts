"use client";

import { useSyncExternalStore } from "react";

/**
 * Store mínimo y compartido del cajón de navegación (sidebar). El sidebar ya no
 * es persistente: vive oculto (contenido a pantalla completa) y se abre/cierra
 * como cajón desde el botón "Axos OS" de la barra superior. Tener el estado en un
 * store compartido (en vez de un evento "abrir") permite que el botón y el cajón
 * estén SIEMPRE en sync —el ícono del botón refleja abierto/cerrado aunque cierres
 * con Esc o el backdrop— y que el mismo botón sirva de toggle.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setNavOpen(value: boolean) {
  if (open === value) return;
  open = value;
  emit();
}

export function toggleNav() {
  open = !open;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactivo: ¿está abierto el cajón? (false en el server → sin mismatch). */
export function useNavOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
