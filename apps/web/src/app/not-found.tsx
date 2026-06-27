import Link from 'next/link';
import { Compass, Home } from 'lucide-react';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { glass } from '@/lib/glass';

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-10 text-slate-950 dark:text-white">
      <AuroraBackground />
      <section className={`${glass} relative z-10 w-full max-w-xl rounded-[2rem] p-8 text-center shadow-2xl`}>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-sky-500/15 text-sky-500">
          <Compass className="size-7" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-white/50">
          404 · AXOS OS
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Ruta no encontrada</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/60">
          El módulo que buscas no existe o fue movido. Vuelve al centro de operaciones para continuar.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            <Home className="size-4" aria-hidden="true" />
            Ir al dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
