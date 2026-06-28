'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Lock, FileText, ExternalLink, Image as ImageIcon, Plus, X,
  CheckCircle2, Boxes, Workflow, Layers, UploadCloud, Download,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import {
  Toolbar, KpiRow, FilterBar, ExportButton, EmptyState,
  DetailDrawer, DrawerSection, DrawerField,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const INDIGO = '#5b63e0';

interface VisualAid {
  id: string;
  model: string;
  title: string;
  process?: string | null;
  area?: string | null;
  revision?: string | null;
  pdfUrl: string; // nombre de archivo → /visual-aids/file/:filename
  isActive?: boolean;
}

function isImage(filename?: string): boolean {
  return !!filename && /\.(png|jpe?g|webp|gif)$/i.test(filename);
}
function fileKind(filename?: string): 'pdf' | 'image' {
  return isImage(filename) ? 'image' : 'pdf';
}

const vaInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

export default function VisualAidsPage() {
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<VisualAid[]>('/visual-aids');
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [filters, setFilters] = useState<FilterValues>({});
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<VisualAid | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const models = useMemo(() => Array.from(new Set(all.map((a) => a.model).filter(Boolean))).sort(), [all]);
  const areas = useMemo(() => Array.from(new Set(all.map((a) => a.area || a.process).filter(Boolean) as string[])).sort(), [all]);

  const filtered = useMemo(() => {
    const model = filters.model as string | undefined;
    const area = filters.area as string | undefined;
    const type = filters.type as string | undefined;
    const estado = filters.estado as string | undefined;
    const ql = query.trim().toLowerCase();
    return all.filter((a) => {
      if (model && a.model !== model) return false;
      if (area && (a.area || a.process) !== area) return false;
      if (type && fileKind(a.pdfUrl) !== type) return false;
      if (estado === 'active' && a.isActive === false) return false;
      if (estado === 'inactive' && a.isActive !== false) return false;
      if (ql && !`${a.title} ${a.model} ${a.process ?? ''} ${a.area ?? ''} ${a.revision ?? ''}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [all, filters, query]);

  // El archivo va con JWT en header → no se puede <a href> directo (daría 401).
  // Se abre la pestaña en el gesto, se baja el blob autenticado y se navega a él.
  async function openInTab(aid: VisualAid) {
    if (!aid.pdfUrl) { toast.error('Esta ayuda no tiene archivo asociado.', 'Ayudas visuales'); return; }
    const win = window.open('', '_blank');
    setOpening(aid.id);
    try {
      const res = await apiFetch(`${API_BASE}/visual-aids/file/${encodeURIComponent(aid.pdfUrl)}`);
      if (!res.ok) { win?.close(); toast.error('No se pudo abrir el archivo.', 'Ayudas visuales'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      win?.close();
      toast.error('Error de red al abrir el archivo.', 'Ayudas visuales');
    } finally { setOpening(null); }
  }

  if (forbidden) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-foreground">
        <div className={`${glass} max-w-sm rounded-3xl p-10 text-center`}>
          <Lock className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="mt-1 text-sm text-gray-400">Inicia sesión para ver las ayudas visuales.</p>
        </div>
      </div>
    );
  }

  const active = all.filter((a) => a.isActive !== false).length;
  const kpiItems: StatCardProps[] = [
    { label: 'Ayudas', value: all.length, color: INDIGO, icon: FileText },
    { label: 'Activas', value: active, color: '#10b981', icon: CheckCircle2 },
    { label: 'Modelos cubiertos', value: models.length, color: '#5b5bd6', icon: Boxes },
    { label: 'Procesos / estaciones', value: areas.length, color: '#0f9bb3', icon: Workflow },
  ];

  const FILTER_DEFS: FilterDef[] = [
    ...(models.length ? [{ key: 'model', type: 'select' as const, label: 'Modelo', options: models.map((m) => ({ value: m, label: m })) }] : []),
    ...(areas.length ? [{ key: 'area', type: 'select' as const, label: 'Estación', options: areas.map((a) => ({ value: a, label: a })) }] : []),
    { key: 'type', type: 'select', label: 'Tipo', options: [{ value: 'pdf', label: 'PDF' }, { value: 'image', label: 'Imagen' }] },
    { key: 'estado', type: 'select', label: 'Estado', options: [{ value: 'active', label: 'Activa' }, { value: 'inactive', label: 'Inactiva' }] },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 text-black md:px-8 dark:text-white">
      <Toolbar
        domain="engineering"
        icon={FileText}
        title="Ayudas visuales · Instructivos"
        subtitle="Biblioteca de instrucciones de trabajo (WI) por modelo y estación, con preview"
        actions={
          <button type="button" onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ background: INDIGO }}>
            <Plus className="h-4 w-4" /> Subir ayuda
          </button>
        }
      >
        <div className="relative">
          <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar título, modelo o estación…" aria-label="Buscar ayudas" className="h-9 w-56 rounded-xl border border-black/10 bg-black/[0.03] pl-8 pr-3 text-sm outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04]" />
        </div>
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<VisualAid> rows={filtered} columns={EXPORT_COLUMNS} filename="ayudas-visuales" />
        </div>
      </Toolbar>

      <div className="mb-6">
        <KpiRow items={kpiItems} columns={4} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          accent={INDIGO}
          title={all.length === 0 ? 'Construye la biblioteca de instructivos' : 'Sin coincidencias'}
          description={all.length === 0
            ? 'Las ayudas visuales (WI) estandarizan cómo se ensambla y prueba cada modelo en cada estación. Súbelas en PDF o imagen y el operador las verá en su terminal.'
            : 'Ninguna ayuda coincide con los filtros. Ajusta el modelo, la estación o el tipo.'}
          hint={all.length === 0 ? [
            'Organiza los instructivos por modelo y estación del ruteo.',
            'Versiona por revisión y marca cuál está activa en piso.',
            'Previsualiza el PDF/imagen sin salir de la biblioteca.',
          ] : undefined}
          primaryAction={all.length === 0 ? { label: 'Subir ayuda', icon: Plus, onClick: () => setShowUpload(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const kind = fileKind(a.pdfUrl);
            const inactive = a.isActive === false;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a)}
                className={`${glass} group flex flex-col rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5 ${inactive ? 'opacity-60' : ''}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: kind === 'image' ? '#0f9bb31f' : `${INDIGO}1f`, color: kind === 'image' ? '#0f9bb3' : INDIGO }}>
                    {kind === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />} {kind === 'image' ? 'Imagen' : 'PDF'}
                  </span>
                  {a.revision && <span className="font-mono text-[11px] text-gray-400">rev {a.revision}</span>}
                  {inactive && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-white/10">inactiva</span>}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{a.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-400">
                  <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: `${INDIGO}14`, color: INDIGO }}>{a.model}</span>
                  <span className="truncate">{[a.process, a.area].filter(Boolean).join(' · ') || 'Sin estación'}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Preview drawer */}
      <PreviewDrawer aid={selected} onClose={() => setSelected(null)} onOpenTab={openInTab} opening={opening} />

      {showUpload && <UploadModal models={models} onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); mutate(); }} />}
    </div>
  );
}

const EXPORT_COLUMNS: ExportColumn<VisualAid>[] = [
  { key: 'title', header: 'Título' },
  { key: 'model', header: 'Modelo' },
  { key: 'process', header: 'Proceso' },
  { key: 'area', header: 'Estación' },
  { key: 'revision', header: 'Revisión' },
  { key: 'type', header: 'Tipo', value: (a) => (fileKind(a.pdfUrl) === 'image' ? 'Imagen' : 'PDF') },
  { key: 'isActive', header: 'Activa', value: (a) => (a.isActive === false ? 'No' : 'Sí') },
  { key: 'pdfUrl', header: 'Archivo' },
];

function PreviewDrawer({ aid, onClose, onOpenTab, opening }: { aid: VisualAid | null; onClose: () => void; onOpenTab: (a: VisualAid) => void; opening: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const kind = aid ? fileKind(aid.pdfUrl) : 'pdf';

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    queueMicrotask(() => {
      if (revoked) return;
      setUrl(null); setError(false);
    });
    if (!aid?.pdfUrl) return;
    queueMicrotask(() => { if (!revoked) setLoading(true); });
    apiFetch(`${API_BASE}/visual-aids/file/${encodeURIComponent(aid.pdfUrl)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch');
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!revoked) setError(true); })
      .finally(() => { if (!revoked) setLoading(false); });
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [aid]);

  return (
    <DetailDrawer
      open={aid !== null}
      onClose={onClose}
      icon={kind === 'image' ? ImageIcon : FileText}
      accent={INDIGO}
      width={680}
      title={aid?.title ?? 'Ayuda visual'}
      subtitle={aid ? `${aid.model}${aid.revision ? ` · rev ${aid.revision}` : ''}` : undefined}
      actions={aid && (
        <button type="button" disabled={opening === aid.id} onClick={() => onOpenTab(aid)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${INDIGO}1f`, color: INDIGO }}>
          {opening === aid.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Abrir en pestaña
        </button>
      )}
    >
      {aid && (
        <>
          <DrawerSection title="Vista previa">
            <div className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
              {loading ? (
                <div className="flex h-[420px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : error ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-gray-400">
                  <X className="h-6 w-6" /> No se pudo cargar la vista previa.
                </div>
              ) : url ? (
                kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={aid.title} className="max-h-[460px] w-full object-contain" />
                ) : (
                  <iframe title={aid.title} src={url} className="h-[460px] w-full" />
                )
              ) : null}
            </div>
          </DrawerSection>

          <DrawerSection title="Detalle">
            <DrawerField label="Modelo"><span className="rounded px-1.5 py-0.5 text-[12px] font-medium" style={{ background: `${INDIGO}14`, color: INDIGO }}>{aid.model}</span></DrawerField>
            <DrawerField label="Proceso">{aid.process || '—'}</DrawerField>
            <DrawerField label="Estación / área">{aid.area || '—'}</DrawerField>
            <DrawerField label="Revisión">{aid.revision ? <span className="font-mono">{aid.revision}</span> : '—'}</DrawerField>
            <DrawerField label="Estado">{aid.isActive === false ? 'Inactiva' : 'Activa'}</DrawerField>
            <DrawerField label="Archivo"><span className="truncate font-mono text-[12px]">{aid.pdfUrl}</span></DrawerField>
          </DrawerSection>

          <DrawerSection title="Relacionados">
            <Link href="/dashboard/routing" className={`${glass} flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/5 text-gray-500 dark:bg-white/10"><Layers className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Ruteo de manufactura</div>
                <div className="truncate text-sm font-medium">Ver estaciones del modelo {aid.model}</div>
              </div>
            </Link>
          </DrawerSection>
        </>
      )}
    </DetailDrawer>
  );
}

function UploadModal({ models, onClose, onUploaded }: { models: string[]; onClose: () => void; onUploaded: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ model: '', title: '', process: '', area: '', revision: 'A', isActive: true });

  async function submit() {
    if (!f.model.trim() || !f.title.trim()) { toast.error('Modelo y título son obligatorios.', 'Ayudas visuales'); return; }
    if (!file) { toast.error('Adjunta un PDF o imagen.', 'Ayudas visuales'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('model', f.model);
      fd.append('title', f.title);
      if (f.process) fd.append('process', f.process);
      if (f.area) fd.append('area', f.area);
      if (f.revision) fd.append('revision', f.revision);
      fd.append('isActive', String(f.isActive));
      const res = await apiFetch(`${API_BASE}/visual-aids`, { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo subir la ayuda.', 'Ayudas visuales');
        return;
      }
      toast.success('Ayuda visual subida.', 'Ayudas visuales');
      onUploaded();
    } catch {
      toast.error('Error de red.', 'Ayudas visuales');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16 backdrop-blur-sm" onClick={onClose}>
      <div className={`${glass} w-full max-w-2xl rounded-3xl p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Subir ayuda visual</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 bg-black/[0.02] px-4 py-8 text-center transition-colors hover:border-indigo-400 dark:border-white/15 dark:bg-white/[0.03]">
          <UploadCloud className="h-7 w-7 text-gray-400" />
          {file ? (
            <span className="text-sm font-medium">{file.name} <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span></span>
          ) : (
            <><span className="text-sm font-medium">Arrastra o elige un archivo</span><span className="text-[12px] text-gray-400">PDF o imagen (JPG, PNG, WEBP) · máx. 12 MB</span></>
          )}
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-[12px] font-medium text-gray-500">Título</span>
            <input className={vaInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="WI — Ensamble PCBA cara A" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-gray-500">Modelo</span>
            <input className={vaInput} list="va-models" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="AX-1000" />
            <datalist id="va-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-gray-500">Revisión</span>
            <input className={vaInput} value={f.revision} onChange={(e) => setF({ ...f, revision: e.target.value })} placeholder="A" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-gray-500">Proceso</span>
            <input className={vaInput} value={f.process} onChange={(e) => setF({ ...f, process: e.target.value })} placeholder="SMT / Ensamble / Prueba" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-gray-500">Estación / área</span>
            <input className={vaInput} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Estación 3" />
          </label>
        </div>

        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
          Activa en piso
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 rotate-180" />} Subir
          </button>
        </div>
      </div>
    </div>
  );
}
