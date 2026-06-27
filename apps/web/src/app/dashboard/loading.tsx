import { glass } from '@/lib/glass';

const placeholderCards = ['Operaciones', 'Calidad', 'Materiales', 'Inteligencia'];

export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-6 py-8 text-slate-950 dark:text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
            <div className="h-9 w-72 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {placeholderCards.map((label) => (
            <div key={label} className={`${glass} rounded-3xl p-5`} aria-label={`Cargando ${label}`}>
              <div className="mb-5 h-4 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
              <div className="h-8 w-20 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
              <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
            </div>
          ))}
        </div>

        <div className={`${glass} rounded-[2rem] p-6`}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="h-6 w-48 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
            <div className="h-9 w-28 animate-pulse rounded-2xl bg-black/10 dark:bg-white/10" />
          </div>
          <div className="grid gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
