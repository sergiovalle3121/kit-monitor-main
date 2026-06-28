'use client';

import React, { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import {
  ErpHeader,
  Tabs,
  DataTable,
  StatCard,
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

interface Valuation {
  rows: Row[];
  totalValue: number;
}

const TABS = [
  { id: 'valuation', label: 'Valuación' },
  { id: 'po', label: 'Órdenes de compra' },
  { id: 'requisitions', label: 'Requisiciones' },
  { id: 'prices', label: 'Precios proveedor' },
];

const PO_STATUS: Record<string, string> = {
  draft: AMBER,
  issued: '#3b82f6',
  partially_received: AMBER,
  received: GREEN,
  closed: '#6b7280',
  cancelled: RED,
};

export default function ErpMmPage() {
  const [tab, setTab] = useState('valuation');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);

  const { data: val } = useApi<Valuation>(tab === 'valuation' ? '/erp/mm/valuation' : null);
  const { data: pos } = useApi<Row[]>(tab === 'po' ? '/erp/mm/purchase-orders' : null);
  const { data: reqs } = useApi<Row[]>(tab === 'requisitions' ? '/erp/mm/requisitions' : null);
  const { data: prices } = useApi<Row[]>(tab === 'prices' ? '/erp/mm/supplier-prices' : null);

  return (
    <div className="min-h-screen text-foreground font-sans pb-24">
      <ErpHeader title="Materiales" subtitle="MM" icon={<Boxes className="w-5 h-5 text-blue-500" />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'valuation' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <StatCard label="Valor total de inventario" value={fmtMoney(val?.totalValue)} color={GREEN} />
              <StatCard label="Partes valuadas" value={fmtNum(val?.rows?.length ?? 0)} />
            </div>
            <DataTable
              exportName="valuacion-inventario"
              rows={val?.rows ?? []}
              emptyText="Sin valuación todavía (recibe una compra)"
              columns={[
                { key: 'partNumber', label: 'Parte' },
                { key: 'method', label: 'Método' },
                { key: 'qty', label: 'Cantidad', align: 'right', render: (r) => fmtNum(r.qty) },
                { key: 'unitCost', label: 'Costo unit.', align: 'right', render: (r) => fmtMoney(r.unitCost) },
                { key: 'value', label: 'Valor', align: 'right', render: (r) => fmtMoney(r.value) },
              ]}
            />
          </>
        )}

        {tab === 'po' && (
          <DataTable
            exportName="ordenes-compra"
            rows={pos ?? []}
            emptyText="Sin órdenes de compra"
            columns={[
              { key: 'poNumber', label: 'PO' },
              { key: 'supplierName', label: 'Proveedor' },
              { key: 'warehouseId', label: 'Almacén' },
              { key: 'totalAmount', label: 'Total', align: 'right', render: (r) => fmtMoney(r.totalAmount) },
              { key: 'expectedDate', label: 'Esperada', render: (r) => fmtDate(r.expectedDate) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => <Pill text={String(r.status)} color={PO_STATUS[String(r.status)] ?? AMBER} />,
              },
            ]}
          />
        )}

        {tab === 'requisitions' && (
          <DataTable
            exportName="requisiciones"
            rows={reqs ?? []}
            emptyText="Sin requisiciones (córrelas con el MRP)"
            columns={[
              { key: 'prNumber', label: 'Requisición' },
              { key: 'partNumber', label: 'Parte' },
              { key: 'quantity', label: 'Cantidad', align: 'right', render: (r) => fmtNum(r.quantity) },
              { key: 'source', label: 'Origen' },
              { key: 'needBy', label: 'Necesaria', render: (r) => fmtDate(r.needBy) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => (
                  <Pill
                    text={String(r.status)}
                    color={r.status === 'open' ? AMBER : r.status === 'converted' ? GREEN : RED}
                  />
                ),
              },
            ]}
          />
        )}

        {tab === 'prices' && (
          <DataTable
            exportName="precios-proveedor"
            rows={prices ?? []}
            emptyText="Sin precios de proveedor"
            columns={[
              { key: 'partNumber', label: 'Parte' },
              { key: 'supplierId', label: 'Proveedor' },
              { key: 'unitPrice', label: 'Precio', align: 'right', render: (r) => fmtMoney(r.unitPrice) },
              { key: 'leadTimeDays', label: 'Lead (días)', align: 'right', render: (r) => fmtNum(r.leadTimeDays) },
              { key: 'moq', label: 'MOQ', align: 'right', render: (r) => fmtNum(r.moq) },
              {
                key: 'preferred',
                label: 'Preferido',
                render: (r) => (r.preferred ? <Pill text="Sí" color={GREEN} /> : '—'),
              },
            ]}
          />
        )}
      </main>
    </div>
  );
}
