import {
  Home,
  Boxes,
  Factory,
  ShieldCheck,
  LineChart,
  Cpu,
  Radio,
  Search,
} from "lucide-react";

/**
 * Mockup de producto para la landing: una recreación fiel (no screenshot) de la
 * Torre de Control de AXOS, con datos de muestra ricos. Vive dentro de un marco
 * de ventana y flota — "muestra el producto" sin depender de capturas frágiles.
 * Es decorativo (aria-hidden) y totalmente responsivo al tema.
 */
const KPIS = [
  { label: "OEE", value: "94.2", unit: "%", tone: "text-emerald-500", up: "+2.1" },
  { label: "Throughput", value: "1,284", unit: "/h", tone: "text-indigo-500", up: "+5.4" },
  { label: "On-time", value: "98.6", unit: "%", tone: "text-sky-500", up: "+0.8" },
  { label: "FPY", value: "99.1", unit: "%", tone: "text-violet-500", up: "+1.2" },
];

const BARS = [62, 78, 70, 88, 95, 74, 90, 82, 97, 86, 92, 80];

const LINES = [
  { name: "SMT-1", status: "Corriendo", dot: "bg-emerald-500", pct: 96 },
  { name: "SMT-2", status: "Corriendo", dot: "bg-emerald-500", pct: 91 },
  { name: "FINAL-A", status: "Andon · ajuste", dot: "bg-amber-500", pct: 68 },
  { name: "TEST-1", status: "Corriendo", dot: "bg-emerald-500", pct: 99 },
];

const RAIL = [Home, Boxes, Factory, ShieldCheck, LineChart, Cpu, Radio];

export function LandingMockup() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl ring-1 ring-black/5 dark:border-white/10 dark:bg-[#0c0c10] dark:ring-white/5"
    >
      {/* Window title bar */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] bg-gray-50/80 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex items-center gap-2 rounded-md bg-black/[0.04] px-3 py-1 text-[11px] text-gray-400 dark:bg-white/[0.06]">
          <ShieldCheck className="h-3 w-3 text-emerald-500" /> axos.os / torre-de-control
        </div>
      </div>

      <div className="flex">
        {/* Mini rail */}
        <div className="hidden flex-col items-center gap-1 border-r border-black/[0.06] bg-gray-50/50 py-3 dark:border-white/10 dark:bg-white/[0.02] sm:flex">
          <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-[10px] font-bold text-background">
            AX
          </div>
          {RAIL.map((Icon, i) => (
            <div
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                i === 4 ? "bg-foreground text-background" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          {/* Top bar */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                <Radio className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[13px] font-bold leading-none">Torre de Control</div>
                <div className="mt-0.5 text-[10px] text-gray-400">Vista ejecutiva · en vivo</div>
              </div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> En control
            </span>
            <div className="hidden items-center gap-1.5 rounded-md bg-black/[0.04] px-2 py-1 text-[10px] text-gray-400 dark:bg-white/[0.06] md:flex">
              <Search className="h-3 w-3" /> ⌘K
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {KPIS.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-black/[0.06] bg-gray-50/60 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  {k.label}
                </div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className={`text-lg font-bold tabular-nums ${k.tone}`}>{k.value}</span>
                  <span className="text-[10px] font-medium text-gray-400">{k.unit}</span>
                </div>
                <div className="mt-0.5 text-[9px] font-medium text-emerald-500">▲ {k.up}%</div>
              </div>
            ))}
          </div>

          {/* Chart + andon */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
            {/* Throughput chart */}
            <div className="rounded-xl border border-black/[0.06] bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  Throughput · últimas 12 h
                </span>
                <span className="text-[10px] font-bold text-indigo-500">+5.4%</span>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {BARS.map((h, i) => (
                  <div key={i} className="flex-1">
                    <div
                      className="w-full rounded-t-[3px] bg-gradient-to-t from-indigo-500/70 to-violet-400"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Andon por línea */}
            <div className="rounded-xl border border-black/[0.06] bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                Andon por línea
              </span>
              <div className="mt-2 space-y-2">
                {LINES.map((l) => (
                  <div key={l.name} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${l.dot}`} />
                    <span className="w-12 flex-shrink-0 text-[10px] font-semibold">{l.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                      <div className={`h-full rounded-full ${l.dot}`} style={{ width: `${l.pct}%` }} />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right text-[9px] tabular-nums text-gray-400">
                      {l.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
