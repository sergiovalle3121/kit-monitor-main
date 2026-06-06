'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';
import {
  ErpHeader,
  Tabs,
  DataTable,
  Pill,
  fmtMoney,
  fmtNum,
  fmtDate,
  GREEN,
  AMBER,
  RED,
  type Row,
} from '@/components/erp/ErpUI';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const TABS = [
  { id: 'orders', label: 'Pedidos' },
  { id: 'invoices', label: 'Facturas (AR)' },
  { id: 'customers', label: 'Clientes' },
];

const SO_STATUS: Record<string, string> = {
  draft: AMBER,
  confirmed: '#3b82f6',
  in_production: AMBER,
  partially_shipped: AMBER,
  shipped: GREEN,
  invoiced: GREEN,
  closed: '#6b7280',
  cancelled: RED,
};

// Next action per sales-order status.
const NEXT_ACTION: Record<string, { label: string; path: string } | undefined> = {
  draft: { label: 'Confirmar', path: 'confirm' },
  confirmed: { label: 'Embarcar', path: 'ship' },
  in_production: { label: 'Embarcar', path: 'ship' },
  partially_shipped: { label: 'Embarcar', path: 'ship' },
  shipped: { label: 'Facturar', path: 'invoice' },
};

export default function ErpSdPage() {
  const [tab, setTab] = useState('orders');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    const map: Record<string, string> = { delivery: 'orders', invoices: 'invoices' };
    const resolved = t ? (map[t] ?? t) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resolved && TABS.some((x) => x.id === resolved)) setTab(resolved);
  }, []);

  const { data: orders, mutate } = useApi<Row[]>(tab === 'orders' ? '/erp/sd/sales-orders' : null);
  const { data: invoices } = useApi<Row[]>(tab === 'invoices' ? '/erp/fin/invoices?kind=AR' : null);
  const { data: customers } = useApi<Row[]>(tab === 'customers' ? '/erp/sd/customers' : null);
  const [busy, setBusy] = useState<number | null>(null);

  async function advance(id: number, path: string) {
    setBusy(id);
    try {
      await apiFetch(`${API_BASE}/erp/sd/sales-orders/${id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-24">
      <ErpHeader title="Ventas" subtitle="SD" icon={<ShoppingCart className="w-5 h-5 text-violet-500" />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'orders' && (
          <DataTable
            exportName="pedidos"
            rows={orders ?? []}
            emptyText="Sin pedidos de cliente"
            columns={[
              { key: 'soNumber', label: 'Pedido' },
              { key: 'customerName', label: 'Cliente' },
              { key: 'orderDate', label: 'Fecha', render: (r) => fmtDate(r.orderDate) },
              { key: 'total', label: 'Total', align: 'right', render: (r) => fmtMoney(r.total) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => <Pill text={String(r.status)} color={SO_STATUS[String(r.status)] ?? AMBER} />,
              },
              {
                key: 'action',
                label: '',
                sortable: false,
                render: (r) => {
                  const next = NEXT_ACTION[String(r.status)];
                  if (!next) return <span className="text-[11px] text-gray-400">—</span>;
                  return (
                    <button
                      onClick={() => advance(Number(r.id), next.path)}
                      disabled={busy === Number(r.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition disabled:opacity-50"
                    >
                      {busy === Number(r.id) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {next.label}
                    </button>
                  );
                },
              },
            ]}
          />
        )}

        {tab === 'invoices' && (
          <DataTable
            exportName="facturas-venta"
            rows={invoices ?? []}
            emptyText="Sin facturas de venta"
            columns={[
              { key: 'invoiceNumber', label: 'Factura' },
              { key: 'partnerId', label: 'Cliente' },
              { key: 'total', label: 'Total', align: 'right', render: (r) => fmtMoney(r.total) },
              { key: 'amountPaid', label: 'Pagado', align: 'right', render: (r) => fmtMoney(r.amountPaid) },
              { key: 'dueDate', label: 'Vence', render: (r) => fmtDate(r.dueDate) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => (
                  <Pill text={String(r.status)} color={r.status === 'paid' ? GREEN : AMBER} />
                ),
              },
            ]}
          />
        )}

        {tab === 'customers' && (
          <DataTable
            exportName="clientes"
            rows={customers ?? []}
            emptyText="Sin clientes"
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nombre' },
              { key: 'currency', label: 'Moneda' },
              { key: 'paymentTermsDays', label: 'Días crédito', align: 'right', render: (r) => fmtNum(r.paymentTermsDays) },
              { key: 'creditLimit', label: 'Límite', align: 'right', render: (r) => fmtMoney(r.creditLimit) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => <Pill text={String(r.status)} color={r.status === 'active' ? GREEN : RED} />,
              },
            ]}
          />
        )}
      </main>
    </div>
  );
}
