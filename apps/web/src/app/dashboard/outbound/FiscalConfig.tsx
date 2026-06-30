'use client';

// Perfil fiscal del emisor para la Carta Porte (CFDI 4.0 / Carta Porte 3.1).
// Tenant-level config: GET/PUT /outbound/fiscal-profile. Lo que aquí se captura
// llena el XML (emisor, permiso SCT, config vehicular, seguros, clave SAT).
import React, { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';

type Profile = {
  emisorRfc: string; emisorNombre: string; regimenFiscal: string; lugarExpedicion: string; origenDomicilio: string;
  permSct: string; numPermisoSct: string; configVehicular: string; aseguraRespCivil: string; polizaRespCivil: string;
  claveProdServDefault: string;
};
const EMPTY: Profile = {
  emisorRfc: '', emisorNombre: '', regimenFiscal: '', lugarExpedicion: '', origenDomicilio: '',
  permSct: '', numPermisoSct: '', configVehicular: '', aseguraRespCivil: '', polizaRespCivil: '', claveProdServDefault: '',
};
const FIELDS: { key: keyof Profile; label: string; ph?: string }[] = [
  { key: 'emisorRfc', label: 'RFC emisor', ph: 'AAA010101AAA' },
  { key: 'emisorNombre', label: 'Razón social' },
  { key: 'regimenFiscal', label: 'Régimen fiscal', ph: '601' },
  { key: 'lugarExpedicion', label: 'CP expedición', ph: '44100' },
  { key: 'permSct', label: 'Permiso SCT', ph: 'TPAF01' },
  { key: 'numPermisoSct', label: 'Núm. permiso SCT' },
  { key: 'configVehicular', label: 'Config. vehicular', ph: 'C2' },
  { key: 'aseguraRespCivil', label: 'Aseguradora RC' },
  { key: 'polizaRespCivil', label: 'Póliza RC' },
  { key: 'claveProdServDefault', label: 'ClaveProdServ', ph: '01010101' },
];

export function FiscalConfig({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/outbound/fiscal-profile`);
        const d = await res.json().catch(() => null);
        if (d) setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, d[k] ?? ''])) } as Profile);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/outbound/fiscal-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'Perfil fiscal');
        return;
      }
      toast.success('Perfil fiscal guardado.', 'Perfil fiscal');
      onClose();
    } catch {
      toast.error('Error de red.', 'Perfil fiscal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg max-h-[88vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold">Perfil fiscal (Carta Porte / CFDI)</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Datos del emisor y del autotransporte que llenan el XML. El timbrado lo hace tu PAC con el CSD.</p>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">{f.label}</span>
                  <input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.ph} className="fc-input" />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </button>
            </div>
          </>
        )}
        <style jsx global>{`
          .fc-input { width: 100%; border-radius: .6rem; padding: .5rem .65rem; background: rgba(0,0,0,.03); border: 1px solid rgba(0,0,0,.08); outline: none; font-size: .8rem; color: inherit; }
          .fc-input:focus { border-color: ${BLUE}; }
          :global(.dark) .fc-input { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
        `}</style>
      </div>
    </div>
  );
}
