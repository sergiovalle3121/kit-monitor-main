'use client';

import React, { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Undo2, Plus, X, Loader2, CheckCircle2, XCircle, Printer, PackageCheck, Inbox, RotateCcw,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import {
  Toolbar, KpiRow, DataTable, ExportButton, EmptyState, DetailDrawer, DrawerSection, DrawerField,
  type StatCardProps, type ExportColumn,
} from '@/components/workspace';
import {
  API_BASE, TEAL, AMBER, GREEN, GRAY, RED, BLUE, inputCls,
  type MaterialReturn, RETURN_STATUS_META, RETURN_REASONS, fmtQty, fmtTime,
} from './shared';
import { ReturnDocument } from './ReturnDocument';

interface ReturnForm {
  partNumber: string; description: string; quantity: string; uom: string; batch: string;
  vendor: string; project: string; fromLocation: string; toWarehouseId: string; toLocation: string;
  reason: string; notes: string;
}
const EMPTY_FORM: ReturnForm = {
  partNumber: '', description: '', quantity: '', uom: 'EA', batch: '', vendor: '', project: '',
  fromLocation: '', toWarehouseId: '', toLocation: 'RETURNS', reason: RETURN_REASONS[0], notes: '',
};

function StatusPill({ status }: { status: string }) {
  const m = RETURN_STATUS_META[status] ?? { label: status, color: GRAY };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
    </span>
  );
}

export default function ReturnsPanel() {
  const { data, isLoading, mutate } = useApi<MaterialReturn[]>('/warehouse/returns');
  const { session } = useDashboardSession();
  const toast = useToast();
  const actor = session?.name || session?.email || 'Almacén';

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [query, setQuery] = useState('');
  const [exportRows, setExportRows] = useState<MaterialReturn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReturnForm>(EMPTY_FORM);
  const [printing, setPrinting] = useState<MaterialReturn | null>(null);

  const selected = useMemo(() => all.find((r) => String(r.id) === selectedId) ?? null, [all, selectedId]);

  const today = new Date().toISOString().slice(0, 10);
  const pending = all.filter((r) => r.status === 'pending').length;
  const completedToday = all.filter((r) => r.status === 'completed' && (r.completedAt || '').slice(0, 10) === today).length;
  const restocked = all.filter((r) => r.restocked).length;

  async function createReturn() {
    if (form.partNumber.trim().length < 1) { toast.error('Indica la parte que regresa.', 'Devoluciones'); return; }
    if (!form.toWarehouseId.trim()) { toast.error('Indica el almacén destino.', 'Devoluciones'); return; }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/warehouse/returns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: form.partNumber, description: form.description || undefined,
          quantity: Number(form.quantity) || 0, uom: form.uom || undefined,
          batch: form.batch || undefined, vendor: form.vendor || undefined, project: form.project || undefined,
          fromLocation: form.fromLocation || undefined, toWarehouseId: form.toWarehouseId,
          toLocation: form.toLocation || undefined, reason: form.reason || undefined, notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo registrar la devolución.', 'Devoluciones');
        return;
      }
      const created: MaterialReturn = await res.json().catch(() => null);
      toast.success('Devolución registrada.', 'Devoluciones');
      setShowForm(false);
      setForm(EMPTY_FORM);
      mutate();
      if (created && created.returnNumber) setPrinting(created); // ofrece el documento al instante
    } catch {
      toast.error('Error de red.', 'Devoluciones');
    } finally { setBusy(null); }
  }

  async function act(r: MaterialReturn, action: 'complete' | 'cancel') {
    setBusy(`${r.id}-${action}`);
    try {
      let body: Record<string, unknown> = { actor };
      if (action === 'cancel') {
        const reason = window.prompt('Motivo de cancelación (opcional):', '');
        if (reason === null) { setBusy(null); return; }
        body = { actor, reason };
      }
      const res = await apiFetch(`${API_BASE}/warehouse/returns/${r.id}/${action}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar la devolución.', 'Devoluciones');
        return;
      }
      toast.success(action === 'complete' ? 'Devolución confirmada — material reingresado.' : 'Devolución cancelada.', 'Devoluciones');
      mutate();
    } catch {
      toast.error('Error de red.', 'Devoluciones');
    } finally { setBusy(null); }
  }

  const kpiItems: StatCardProps[] = [
    { label: 'Por confirmar', value: pending, color: pending ? AMBER : GREEN, icon: Inbox },
    { label: 'Confirmadas hoy', value: completedToday, color: TEAL, icon: PackageCheck },
    { label: 'Reingresadas', value: restocked, color: GREEN, icon: RotateCcw },
    { label: 'Total', value: all.length, color: BLUE, icon: Undo2 },
  ];

  const COLUMNS: ColumnDef<MaterialReturn, unknown>[] = [
    {
      accessorKey: 'partNumber', header: 'Material',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{row.original.returnNumber}</span>
          <span className="truncate font-mono font-medium">{row.original.partNumber}</span>
        </div>
      ),
      meta: { filterable: true, filterPlaceholder: 'Parte o folio…' },
    },
    { id: 'qty', accessorFn: (r) => r.quantity ?? 0, header: 'Cant.', cell: ({ row }) => <span className="tabular-nums font-medium">{fmtQty(row.original.quantity)} {row.original.uom || ''}</span>, meta: { align: 'right' } },
    { accessorKey: 'batch', header: 'Batch', cell: ({ getValue }) => <span className="font-mono text-[12px] text-gray-500">{(getValue() as string) || '—'}</span> },
    { accessorKey: 'vendor', header: 'Vendor', cell: ({ getValue }) => <span className="text-gray-500">{(getValue() as string) || '—'}</span> },
    { id: 'route', accessorFn: (r) => `${r.fromLocation || ''}→${r.toLocation || r.toWarehouseId || ''}`, header: 'Origen → Destino', cell: ({ row }) => <span className="truncate text-gray-500 dark:text-gray-400">{[row.original.fromLocation, row.original.toLocation || row.original.toWarehouseId].filter(Boolean).join(' → ') || '—'}</span> },
    { accessorKey: 'reason', header: 'Motivo', cell: ({ getValue }) => <span className="text-gray-500">{(getValue() as string) || '—'}</span> },
    { id: 'status', accessorFn: (r) => RETURN_STATUS_META[r.status as string]?.label ?? r.status, header: 'Estado', cell: ({ row }) => <StatusPill status={row.original.status as string} /> },
  ];

  const EXPORT_COLUMNS: ExportColumn<MaterialReturn>[] = [
    { key: 'returnNumber', header: 'Folio' },
    { key: 'partNumber', header: 'Parte' },
    { key: 'quantity', header: 'Cantidad', value: (r) => r.quantity ?? '' },
    { key: 'uom', header: 'UoM' },
    { key: 'batch', header: 'Batch' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'project', header: 'Proyecto' },
    { key: 'fromLocation', header: 'Origen' },
    { key: 'toWarehouseId', header: 'Almacén destino' },
    { key: 'toLocation', header: 'Ubicación destino' },
    { key: 'reason', header: 'Motivo' },
    { key: 'restocked', header: 'Reingresado', value: (r) => (r.restocked ? 'SÍ' : 'no') },
    { key: 'status', header: 'Estado', value: (r) => RETURN_STATUS_META[r.status as string]?.label ?? String(r.status) },
    { key: 'createdAt', header: 'Registrada', value: (r) => (r.createdAt ? r.createdAt.slice(0, 16).replace('T', ' ') : '') },
  ];

  return (
    <div>
      <Toolbar
        domain="warehouse"
        icon={Undo2}
        title="Devoluciones de material · return to stock"
        subtitle="Registra material que regresa al almacén y genera su documento de devolución"
        actions={
          <button type="button" onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ background: TEAL }}>
            <Plus className="h-4 w-4" /> Registrar devolución
          </button>
        }
      >
        <div className="ml-auto">
          <ExportButton<MaterialReturn> rows={exportRows} columns={EXPORT_COLUMNS} filename="devoluciones" />
        </div>
      </Toolbar>

      <div className="mb-5"><KpiRow items={kpiItems} columns={4} /></div>

      {showForm && (
        <div className={`${glass} mb-5 rounded-2xl p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Registrar devolución</h3>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Parte *</span>
              <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="IC-MCU-32B" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Cantidad</span>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="18" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Batch / Lote</span>
              <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="L-MCU-2611" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Vendor</span>
              <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="AX-SUP-NORVEL" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Proyecto</span>
              <input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} placeholder="AX-MOBILITY" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Origen (línea/estación)</span>
              <input value={form.fromLocation} onChange={(e) => setForm({ ...form, fromLocation: e.target.value })} placeholder="L1-POU" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Almacén destino *</span>
              <input value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })} placeholder="AX-WH-NORTE-RM" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Ubicación destino</span>
              <input value={form.toLocation} onChange={(e) => setForm({ ...form, toLocation: e.target.value })} placeholder="RET-01" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Motivo</span>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputCls}>
                {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block md:col-span-3">
              <span className="mb-1 block text-[12px] font-medium text-gray-500">Notas</span>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Detalle adicional…" className={inputCls} />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createReturn} disabled={busy === 'new'} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registrar y generar documento
            </button>
          </div>
        </div>
      )}

      <DataTable<MaterialReturn>
        data={all}
        columns={COLUMNS}
        getRowId={(r) => String(r.id)}
        isLoading={isLoading}
        searchable
        searchPlaceholder="Buscar folio, parte, vendor…"
        globalFilter={query}
        onGlobalFilterChange={setQuery}
        onFilteredRowsChange={setExportRows}
        onRowClick={(r) => setSelectedId(String(r.id))}
        pageSize={15}
        emptyState={
          <EmptyState
            icon={Undo2}
            accent={TEAL}
            title="Sin devoluciones registradas"
            description="Cuando material regresa al almacén (sobrante de kit, cambio de orden, recuperable), regístralo aquí: queda trazado con parte, batch, vendor y origen→destino, y genera su documento/etiqueta imprimible."
            hint={[
              'Cada devolución produce un documento con folio para acompañar el material.',
              'Al confirmarla, el stock puede reingresar al inventario automáticamente.',
              'Filtra, busca y exporta el histórico a CSV.',
            ]}
            primaryAction={{ label: 'Registrar la primera devolución', onClick: () => setShowForm(true), icon: Plus }}
          />
        }
      />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        icon={Undo2}
        accent={TEAL}
        title={selected ? selected.partNumber : 'Devolución'}
        subtitle={selected ? selected.returnNumber : undefined}
        actions={selected && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPrinting(selected)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium" style={{ background: `${BLUE}1f`, color: BLUE }}>
              <Printer className="h-4 w-4" /> Documento
            </button>
            {selected.status === 'pending' && (
              <>
                <button type="button" disabled={busy !== null} onClick={() => act(selected, 'complete')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>
                  {busy === `${selected.id}-complete` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar
                </button>
                <button type="button" disabled={busy !== null} onClick={() => act(selected, 'cancel')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50" style={{ background: `${RED}1f`, color: RED }}>
                  <XCircle className="h-4 w-4" /> Cancelar
                </button>
              </>
            )}
          </div>
        )}
      >
        {selected && (
          <>
            <DrawerSection title="Devolución">
              <DrawerField label="Estado"><StatusPill status={selected.status as string} /></DrawerField>
              <DrawerField label="Parte"><span className="font-mono">{selected.partNumber}</span></DrawerField>
              {selected.description && <DrawerField label="Descripción">{selected.description}</DrawerField>}
              <DrawerField label="Cantidad">{fmtQty(selected.quantity)} {selected.uom || ''}</DrawerField>
              {selected.batch && <DrawerField label="Batch"><span className="font-mono">{selected.batch}</span></DrawerField>}
              {selected.vendor && <DrawerField label="Vendor">{selected.vendor}</DrawerField>}
              {selected.project && <DrawerField label="Proyecto">{selected.project}</DrawerField>}
              <DrawerField label="Reingresado">{selected.restocked ? 'Sí — stock actualizado' : 'No'}</DrawerField>
            </DrawerSection>
            <DrawerSection title="Ruta y motivo">
              <DrawerField label="Origen">{selected.fromLocation || '—'}</DrawerField>
              <DrawerField label="Destino">{[selected.toWarehouseId, selected.toLocation].filter(Boolean).join(' · ') || '—'}</DrawerField>
              <DrawerField label="Motivo">{selected.reason || '—'}</DrawerField>
              {selected.notes && <DrawerField label="Notas">{selected.notes}</DrawerField>}
              <DrawerField label="Registrada">{fmtTime(selected.createdAt)} · {selected.createdBy || '—'}</DrawerField>
              {selected.completedAt && <DrawerField label="Cerrada">{fmtTime(selected.completedAt)} · {selected.completedBy || '—'}</DrawerField>}
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

      {printing && <ReturnDocument ret={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}
