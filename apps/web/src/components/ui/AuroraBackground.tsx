/**
 * Fondo "aurora": tintes pastel muy tenues en las esquinas sobre una base casi
 * blanca (oscuro: misma idea sobre #0b0b0f). Fijo detrás del contenido (-z-10),
 * decorativo (aria-hidden, sin eventos). El gradiente vive en globals.css
 * (`.aurora-bg`, con su variante prefers-color-scheme: dark) para mantener una
 * sola fuente de verdad y respetar el modo oscuro de la app (Tailwind v4).
 */
export function AuroraBackground({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`aurora-bg pointer-events-none fixed inset-0 -z-10 ${className}`} />;
}
