import Link from 'next/link';
import { Compass, Search } from 'lucide-react';
import { glass } from '@/lib/glass';

const suggestions = [
  { href: '/dashboard/control-tower', label: 'Control Tower' },
  { href: '/dashboard/production', label: 'Producción' },
  { href: '/dashboard/quality', label: 'Calidad' },
];

export default function DashboardNotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10 text-slate-950 dark:text-white">
      <section className={`${glass} w-full max-w-2xl rounded-[2rem] p-8 text-center shadow-2xl`}>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-3xl bg-indigo-500/15 text-indigo-500">
          <Compass className="size-7" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-white/50">
          Módulo no encontrado
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Esta vista aún no existe</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-white/60">
          La ruta puede haber cambiado, estar en rollout o no estar incluida en tu workspace actual.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            <Search className="size-4" aria-hidden="true" />
            Ver todos los módulos
          </Link>
          {suggestions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
