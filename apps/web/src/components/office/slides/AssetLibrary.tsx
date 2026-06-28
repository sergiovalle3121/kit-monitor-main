'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, SendToBack } from 'lucide-react';

export type SlideAssetCategory = 'lean' | 'quality' | 'safety' | 'production' | 'engineering';

export interface SlideAssetSymbol {
  id: string;
  label: string;
  category: SlideAssetCategory;
  keywords: string[];
  svg: string;
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${body}</svg>`;

export const INDUSTRIAL_ASSETS: SlideAssetSymbol[] = [
  { id: 'andON', label: 'Andon', category: 'production', keywords: ['linea', 'status', 'andon', 'produccion'], svg: svg('<rect x="18" y="16" width="60" height="52" rx="10" fill="#111827"/><circle cx="34" cy="36" r="9" fill="#ef4444"/><circle cx="48" cy="36" r="9" fill="#f59e0b"/><circle cx="62" cy="36" r="9" fill="#10b981"/><rect x="30" y="68" width="36" height="8" rx="4" fill="#6b7280"/>') },
  { id: 'workcell', label: 'Celda', category: 'production', keywords: ['celda', 'maquina', 'manufactura'], svg: svg('<rect x="16" y="22" width="64" height="46" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="5"/><rect x="26" y="34" width="18" height="18" rx="3" fill="#0284c7"/><path d="M52 34h14v26H52z" fill="#0369a1"/><path d="M18 76h60" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>') },
  { id: 'kanban', label: 'Kanban', category: 'lean', keywords: ['kanban', 'pull', 'tarjeta'], svg: svg('<rect x="14" y="18" width="68" height="56" rx="8" fill="#fef3c7" stroke="#d97706" stroke-width="4"/><path d="M26 34h44M26 48h30M26 62h38" stroke="#92400e" stroke-width="6" stroke-linecap="round"/><circle cx="68" cy="58" r="8" fill="#10b981"/>') },
  { id: 'kaizen', label: 'Kaizen', category: 'lean', keywords: ['kaizen', 'mejora', 'lean'], svg: svg('<path d="M48 12l9 24h25L62 51l8 25-22-15-22 15 8-25-20-15h25z" fill="#f59e0b"/><path d="M34 50l9 9 20-24" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>') },
  { id: 'pareto', label: 'Pareto', category: 'quality', keywords: ['pareto', 'calidad', 'defectos'], svg: svg('<rect x="18" y="58" width="12" height="22" fill="#3b82f6"/><rect x="38" y="42" width="12" height="38" fill="#2563eb"/><rect x="58" y="24" width="12" height="56" fill="#1d4ed8"/><path d="M16 62c18-18 36-25 62-42" fill="none" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/><path d="M14 82h68" stroke="#111827" stroke-width="5" stroke-linecap="round"/>') },
  { id: 'capa', label: 'CAPA', category: 'quality', keywords: ['capa', 'accion correctiva', 'calidad'], svg: svg('<circle cx="48" cy="48" r="34" fill="#dcfce7" stroke="#16a34a" stroke-width="5"/><path d="M32 48l11 11 22-25" fill="none" stroke="#166534" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M70 70l12 12" stroke="#16a34a" stroke-width="7" stroke-linecap="round"/>') },
  { id: 'ppe', label: 'EPP', category: 'safety', keywords: ['seguridad', 'epp', 'safety'], svg: svg('<path d="M25 44c0-19 12-31 23-31s23 12 23 31v8H25z" fill="#facc15" stroke="#a16207" stroke-width="4"/><path d="M18 52h60v10a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill="#fde68a" stroke="#a16207" stroke-width="4"/><path d="M48 16v34" stroke="#a16207" stroke-width="4"/>') },
  { id: 'hazard', label: 'Riesgo', category: 'safety', keywords: ['riesgo', 'alerta', 'hazard'], svg: svg('<path d="M48 12l38 68H10z" fill="#fee2e2" stroke="#dc2626" stroke-width="6" stroke-linejoin="round"/><path d="M48 34v22" stroke="#991b1b" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="68" r="5" fill="#991b1b"/>') },
  { id: 'ecn', label: 'ECN', category: 'engineering', keywords: ['ingenieria', 'cambio', 'ecn'], svg: svg('<rect x="20" y="14" width="48" height="68" rx="6" fill="#eef2ff" stroke="#4f46e5" stroke-width="5"/><path d="M32 32h24M32 46h24M32 60h16" stroke="#3730a3" stroke-width="5" stroke-linecap="round"/><path d="M62 54l16 16M78 54L62 70" stroke="#f97316" stroke-width="7" stroke-linecap="round"/>') },
  { id: 'bom', label: 'BOM tree', category: 'engineering', keywords: ['bom', 'estructura', 'materiales'], svg: svg('<circle cx="48" cy="20" r="10" fill="#0ea5e9"/><circle cx="28" cy="66" r="10" fill="#38bdf8"/><circle cx="68" cy="66" r="10" fill="#38bdf8"/><path d="M48 30v14M48 44H28v12M48 44h20v12" stroke="#0f172a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>') },
];

const CATEGORY_LABEL: Record<SlideAssetCategory, string> = {
  production: 'Producción', lean: 'Lean', quality: 'Calidad', safety: 'Seguridad', engineering: 'Ingeniería',
};

export function SlideAssetLibrary({ onPick }: { onPick: (asset: SlideAssetSymbol) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SlideAssetCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INDUSTRIAL_ASSETS.filter((asset) => {
      const inCategory = category === 'all' || asset.category === category;
      const inQuery = !q || asset.label.toLowerCase().includes(q) || asset.keywords.some((k) => k.includes(q));
      return inCategory && inQuery;
    });
  }, [category, query]);
  const selected = filtered.find((asset) => asset.id === selectedId) ?? filtered[0];
  useEffect(() => {
    if (!selectedId || !filtered.some((asset) => asset.id === selectedId)) setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);
  const quickTerms = ['OEE', 'CAPA', 'Kanban', 'BOM', 'Safety'];
  return (
    <div className="w-[390px] p-3 space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 h-9">
        <Search className="w-4 h-4 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar símbolo industrial…" className="flex-1 bg-transparent outline-none text-sm" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quickTerms.map((term) => (
          <button key={term} onClick={() => setQuery(term)} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-[10px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20">{term}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'production', 'lean', 'quality', 'safety', 'engineering'] as const).map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${category === c ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/10 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
            {c === 'all' ? 'Todo' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {selected && (
        <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/10 p-3 flex items-center gap-3">
          <span className="w-16 h-16 rounded-xl bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 p-2 flex-shrink-0" dangerouslySetInnerHTML={{ __html: selected.svg }} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{selected.label}</span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{CATEGORY_LABEL[selected.category]} · {selected.keywords.slice(0, 3).join(' · ')}</span>
            <button onClick={() => onPick(selected)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"><SendToBack className="w-3.5 h-3.5" /> Insertar símbolo</button>
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
        {filtered.map((asset) => (
          <button key={asset.id} onClick={() => setSelectedId(asset.id)} onDoubleClick={() => onPick(asset)} className={`group text-left rounded-xl border p-2 transition-colors ${selected?.id === asset.id ? 'border-blue-400 bg-blue-50/70 dark:bg-blue-500/10' : 'border-black/10 dark:border-white/10 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/10'}`}>
            <span className="flex items-center gap-2">
              <span className="w-11 h-11 rounded-lg bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 p-1.5 flex-shrink-0" dangerouslySetInnerHTML={{ __html: asset.svg }} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{asset.label}</span>
                <span className="block text-[10px] text-gray-400">{CATEGORY_LABEL[asset.category]}</span>
                <span className="block text-[9px] text-gray-400 truncate">{asset.keywords.slice(0, 2).join(' · ')}</span>
              </span>
            </span>
          </button>
        ))}
        {!filtered.length && <p className="col-span-2 py-8 text-center text-xs text-gray-400">Sin símbolos para esta búsqueda.</p>}
      </div>
    </div>
  );
}
