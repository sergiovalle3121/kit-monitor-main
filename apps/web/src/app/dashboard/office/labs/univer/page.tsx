'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft, FlaskConical, Check, X, DollarSign, Scale, Package, AlertTriangle,
  Sparkles, ListChecks, ThumbsDown, ThumbsUp, BookOpen,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { container, item } from '@/lib/motion';

/**
 * Spike AISLADO de Univer (Apache-2.0, OSS) como ruta a paridad real en Hojas.
 * Tablero de evaluación — NO instala Univer ni toca el Office real. El informe
 * completo está en REPORT.md (mismo directorio).
 */

type Cell = 'yes' | 'no' | 'pro' | 'partial';
const CellMark = ({ v, note }: { v: Cell; note?: string }) => {
  const map: Record<Cell, { icon: React.ReactNode; cls: string; label: string }> = {
    yes: { icon: <Check className="w-4 h-4" />, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Sí' },
    no: { icon: <X className="w-4 h-4" />, cls: 'text-red-500', label: 'No' },
    pro: { icon: <DollarSign className="w-4 h-4" />, cls: 'text-amber-600 dark:text-amber-400', label: 'Pro (pago)' },
    partial: { icon: <span className="text-xs font-bold">~</span>, cls: 'text-gray-500', label: 'Parcial' },
  };
  const m = map[v];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${m.cls}`}>
      {m.icon}<span className="hidden sm:inline">{note || m.label}</span>
    </span>
  );
};

const FEATURES: { feature: string; fs: Cell; oss: Cell; pro: Cell; fsNote?: string; ossNote?: string; proNote?: string }[] = [
  { feature: 'Motor de fórmulas', fs: 'partial', oss: 'yes', pro: 'yes', fsNote: 'Set limitado', ossNote: '500+ fn, grafo', proNote: 'Avanzado' },
  { feature: 'Tablas dinámicas (pivot)', fs: 'no', oss: 'no', pro: 'pro' },
  { feature: 'Gráficas', fs: 'yes', oss: 'no', pro: 'pro', fsNote: 'Chart.js' },
  { feature: 'Sparklines', fs: 'no', oss: 'no', pro: 'pro' },
  { feature: 'Formato condicional', fs: 'yes', oss: 'yes', pro: 'yes', fsNote: 'Capa AXOS' },
  { feature: 'Validación / filtro / ordenar', fs: 'yes', oss: 'yes', pro: 'yes' },
  { feature: 'Buscar y reemplazar / notas', fs: 'yes', oss: 'yes', pro: 'yes' },
  { feature: 'Formato de número', fs: 'partial', oss: 'yes', pro: 'yes' },
  { feature: 'Import/Export .xlsx', fs: 'yes', oss: 'partial', pro: 'pro', fsNote: 'SheetJS', ossNote: 'Seguir con SheetJS', proNote: 'Exchange svc' },
  { feature: 'Impresión / PDF nativo', fs: 'partial', oss: 'no', pro: 'pro' },
];

function StatCard({ icon, tint, label, children }: { icon: React.ReactNode; tint: string; label: string; children: React.ReactNode }) {
  return (
    <motion.div variants={item} className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161616] p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`inline-flex p-2 rounded-xl ${tint}`}>{icon}</span>
        <h3 className="font-bold text-sm">{label}</h3>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5">{children}</div>
    </motion.div>
  );
}

export default function UniverSpikePage() {
  const [tab, setTab] = useState<'matrix' | 'detail'>('matrix');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/dashboard/office" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors mb-5">
        <ChevronLeft className="w-4 h-4" /> Office
      </Link>

      <motion.div variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="flex items-start gap-4 mb-6">
          <IconTile domain="office" size={52} icon={FlaskConical} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">Spike · Univer para Hojas</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">AISLADO · sin instalar deps</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Evaluación de <strong>Univer 0.25</strong> (Apache-2.0, OSS) como ruta a paridad real
              (tablas dinámicas + motor de fórmulas) frente a Fortune-Sheet. No toca el Office real.
            </p>
          </div>
        </motion.div>

        {/* Veredicto */}
        <motion.div variants={item} className="rounded-3xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.07] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <ThumbsDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-bold">Recomendación: quedarnos con Fortune-Sheet (por ahora)</h2>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Univer <strong>OSS no resuelve el motivo del spike</strong>: las <strong>tablas dinámicas son Pro (de pago)</strong>,
            igual que gráficas, sparklines, impresión, el motor de fórmulas «avanzado» y el .xlsx oficial.
            Migrar a Univer OSS sumaría bundle (~3–5×) y ~1–2 semanas de trabajo <em>sin</em> obtener pivots.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div className="rounded-2xl bg-white/70 dark:bg-white/5 p-3 text-sm">
              <p className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><ThumbsUp className="w-4 h-4" /> Mejor camino para pivots</p>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Construir un <strong>pivot propio</strong> sobre <code>celldata</code> (group-by → tabla de salida). Sin deps nuevas; entrega justo lo que falta.</p>
            </div>
            <div className="rounded-2xl bg-white/70 dark:bg-white/5 p-3 text-sm">
              <p className="font-semibold flex items-center gap-1.5 text-blue-600 dark:text-blue-400"><DollarSign className="w-4 h-4" /> Cuándo sí reconsiderar Univer</p>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Si hay <strong>presupuesto para Univer Pro</strong> (pivot/chart/print/fórmula avanzada) o la corrección del motor de fórmulas se vuelve crítica.</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4">
          {([['matrix', 'Matriz comparativa'], ['detail', 'Licencia · bundle · riesgos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`text-sm font-semibold px-3.5 py-2 rounded-full transition-colors ${tab === k ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'matrix' ? (
          <motion.div variants={item} className="rounded-3xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#161616] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 font-semibold">Capacidad</th>
                    <th className="px-4 py-3 font-semibold">Fortune-Sheet</th>
                    <th className="px-4 py-3 font-semibold">Univer OSS</th>
                    <th className="px-4 py-3 font-semibold">Univer Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((f) => (
                    <tr key={f.feature} className="border-b border-black/[0.03] dark:border-white/[0.06] last:border-0">
                      <td className="px-4 py-3 text-sm font-medium">{f.feature}</td>
                      <td className="px-4 py-3"><CellMark v={f.fs} note={f.fsNote} /></td>
                      <td className="px-4 py-3"><CellMark v={f.oss} note={f.ossNote} /></td>
                      <td className="px-4 py-3"><CellMark v={f.pro} note={f.proNote} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-[11px] text-gray-400 border-t border-black/5 dark:border-white/10">
              <Check className="w-3 h-3 inline text-emerald-500" /> nativo/disponible · <DollarSign className="w-3 h-3 inline text-amber-500" /> requiere Univer Pro (pago) · <X className="w-3 h-3 inline text-red-500" /> no disponible
            </p>
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
            <StatCard icon={<Scale className="w-4 h-4 text-indigo-500" />} tint="bg-indigo-500/10" label="Licencia">
              <p>Todos los <code>@univerjs/*</code> = <strong>Apache-2.0</strong> ✅.</p>
              <p>Motor de fórmulas OSS <strong>no usa HyperFormula</strong> (propio) → sin GPL.</p>
              <p className="text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5 inline" /> <code>@univerjs/presets</code> arrastra <code>@univerjs-pro/*</code> (comerciales) — evitar; usar solo <code>preset-sheets-core</code>.</p>
            </StatCard>
            <StatCard icon={<Package className="w-4 h-4 text-emerald-500" />} tint="bg-emerald-500/10" label="Bundle">
              <p>Univer ≈ <strong>1.0–1.8 MB gzip</strong> (motor render canvas + UI propia).</p>
              <p>Fortune-Sheet ≈ 300–500 KB → Univer <strong>~3–5× más pesado</strong>.</p>
              <p className="text-gray-400">El editor ya carga con <code>dynamic(ssr:false)</code> (costo bajo demanda).</p>
            </StatCard>
            <StatCard icon={<DollarSign className="w-4 h-4 text-amber-500" />} tint="bg-amber-500/10" label="OSS vs Pro (de pago)">
              <p><strong>Pro:</strong> pivot, gráficas, sparklines, impresión, fórmula avanzada, exchange .xlsx.</p>
              <p><strong>OSS:</strong> fórmulas (mejor que FS), cond-format, validación, filtro, ordenar, buscar, notas, numfmt.</p>
            </StatCard>
            <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-500" />} tint="bg-red-500/10" label="Riesgos">
              <p>Paywall OSS↔Pro empuja a licencia comercial para «paridad».</p>
              <p>Migración alta (~1–2 sem): modelo de datos distinto, rehacer capa AXOS, SSR Next 16/React 19.</p>
              <p>Cadencia 0.x con cambios rompientes.</p>
            </StatCard>
            <StatCard icon={<Sparkles className="w-4 h-4 text-blue-500" />} tint="bg-blue-500/10" label="Esfuerzo de migración (solo Hojas)">
              <p>Adaptador <code>IWorkbookData</code> ⇄ <code>{'{ sheets, charts }'}</code> + migración de docs en BD.</p>
              <p>Reescribir <code>SheetEditor</code> + capa de profundidad; registrar plugins a mano (OSS-only).</p>
            </StatCard>
            <StatCard icon={<ListChecks className="w-4 h-4 text-violet-500" />} tint="bg-violet-500/10" label="Conclusión">
              <p>OSS solo aporta <strong>mejor motor de fórmulas</strong>; pivots/charts son Pro.</p>
              <p><strong>Pivot propio sobre Fortune-Sheet</strong> = mejor relación valor/riesgo.</p>
            </StatCard>
          </motion.div>
        )}

        <motion.div variants={item} className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <BookOpen className="w-4 h-4" />
          Informe completo en <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">apps/web/src/app/dashboard/office/labs/univer/REPORT.md</code>
        </motion.div>
      </motion.div>
    </div>
  );
}
