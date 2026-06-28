'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DatabaseZap, X } from 'lucide-react';
import { AXOS_CONNECTOR_BY_TYPE, connectorParamSummary, validateConnectorParams, type AxosConnectorType } from '@/lib/office/axosConnectors';

export function SheetConnectorParams({ type, onApply, onClose }: {
  type: AxosConnectorType;
  onApply: (params: Record<string, string>) => void;
  onClose: () => void;
}) {
  const def = AXOS_CONNECTOR_BY_TYPE[type];
  const [params, setParams] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const validation = useMemo(() => validateConnectorParams(type, params), [type, params]);
  const field = 'h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  const setParam = (key: string, value: string) => {
    setErrors([]);
    setParams((prev) => ({ ...prev, [key]: value }));
  };
  const apply = () => {
    const next = validateConnectorParams(type, params);
    if (!next.ok) { setErrors(next.errors); return; }
    onApply(next.params);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10">
          <DatabaseZap className="w-5 h-5 text-emerald-600" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">Conector AXOS · {def.label}</h2>
            <p className="text-[11px] text-gray-500 truncate">{def.domain} · {def.refreshPolicy === 'scheduled-ready' ? 'refresh programable' : 'refresh manual'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-50/70 dark:bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="font-semibold">Contrato read-only</div>
            <div className="mt-1 font-mono break-all">GET {def.endpoint}</div>
            <div className="mt-1 text-emerald-700/80 dark:text-emerald-200/80">{def.description}</div>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Parámetros · {connectorParamSummary(type)}</div>
            {def.params.length ? def.params.map((param) => (
              <label key={param.key} className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{param.label}{param.required ? ' *' : ''}</span>
                {param.type === 'select' ? (
                  <select value={params[param.key] ?? ''} onChange={(e) => setParam(param.key, e.target.value)} className={field}>
                    <option value="">Todos / sin filtro</option>
                    {param.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input value={params[param.key] ?? ''} onChange={(e) => setParam(param.key, e.target.value)} type={param.type === 'date' ? 'date' : 'text'} placeholder={param.type === 'date' ? 'YYYY-MM-DD' : param.label} className={field} />
                )}
              </label>
            )) : <p className="text-sm text-gray-500">Este conector no requiere parámetros.</p>}
          </div>
          {(errors.length > 0 || (!validation.ok && Object.keys(params).length > 0)) && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {(errors.length ? errors : validation.errors).join(' ')}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Insertar tabla gobernada</button>
            <button onClick={onClose} className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
