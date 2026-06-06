'use client';

import React, { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import {
  ErpHeader,
  Tabs,
  DataTable,
  StatCard,
  Pill,
  fmtMoney,
  fmtDate,
  GREEN,
  AMBER,
  RED,
  type Row,
} from '@/components/erp/ErpUI';
import { useApi } from '@/hooks/useApi';

interface TrialBalance {
  rows: Row[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

const TABS = [
  { id: 'trial', label: 'Balanza' },
  { id: 'journals', label: 'Asientos' },
  { id: 'invoices', label: 'Facturas (AR/AP)' },
  { id: 'cost-centers', label: 'Centros de costo' },
];

const INV_STATUS: Record<string, string> = {
  draft: AMBER,
  posted: GREEN,
  partially_paid: AMBER,
  paid: GREEN,
  cancelled: RED,
};

export default function ErpFinPage() {
  const [tab, setTab] = useState('trial');
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);

  const { data: tb } = useApi<TrialBalance>(tab === 'trial' ? '/erp/fin/reports/trial-balance' : null);
  const { data: journals } = useApi<Row[]>(tab === 'journals' ? '/erp/fin/journals' : null);
  const { data: invoices } = useApi<Row[]>(tab === 'invoices' ? '/erp/fin/invoices' : null);
  const { data: cc } = useApi<Row[]>(tab === 'cost-centers' ? '/erp/fin/cost-centers' : null);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-24">
      <ErpHeader title="Finanzas" subtitle="FI/CO" icon={<Landmark className="w-5 h-5 text-emerald-500" />} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'trial' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
              <StatCard label="Total débito" value={fmtMoney(tb?.totalDebit)} />
              <StatCard label="Total crédito" value={fmtMoney(tb?.totalCredit)} />
              <StatCard
                label="Cuadre"
                value={tb?.balanced ? 'Cuadrada ✓' : 'Descuadre'}
                color={tb?.balanced ? GREEN : RED}
              />
            </div>
            <DataTable
              exportName="balanza"
              rows={tb?.rows ?? []}
              columns={[
                { key: 'accountCode', label: 'Cuenta' },
                { key: 'accountName', label: 'Nombre' },
                { key: 'type', label: 'Tipo' },
                { key: 'debit', label: 'Débito', align: 'right', render: (r) => fmtMoney(r.debit) },
                { key: 'credit', label: 'Crédito', align: 'right', render: (r) => fmtMoney(r.credit) },
                { key: 'balance', label: 'Saldo', align: 'right', render: (r) => fmtMoney(r.balance) },
              ]}
            />
          </>
        )}

        {tab === 'journals' && (
          <DataTable
            exportName="asientos"
            rows={journals ?? []}
            emptyText="Sin asientos contables todavía"
            columns={[
              { key: 'docNumber', label: 'Folio' },
              { key: 'postingDate', label: 'Fecha', render: (r) => fmtDate(r.postingDate) },
              { key: 'docType', label: 'Tipo' },
              { key: 'totalDebit', label: 'Importe', align: 'right', render: (r) => fmtMoney(r.totalDebit) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => (
                  <Pill text={String(r.status)} color={r.status === 'reversed' ? RED : GREEN} />
                ),
              },
            ]}
          />
        )}

        {tab === 'invoices' && (
          <DataTable
            exportName="facturas"
            rows={invoices ?? []}
            emptyText="Sin facturas todavía"
            columns={[
              { key: 'invoiceNumber', label: 'Factura' },
              {
                key: 'kind',
                label: 'Tipo',
                render: (r) => (
                  <Pill text={String(r.kind)} color={r.kind === 'AR' ? GREEN : AMBER} />
                ),
              },
              { key: 'partnerId', label: 'Contraparte' },
              { key: 'total', label: 'Total', align: 'right', render: (r) => fmtMoney(r.total) },
              { key: 'amountPaid', label: 'Pagado', align: 'right', render: (r) => fmtMoney(r.amountPaid) },
              { key: 'dueDate', label: 'Vence', render: (r) => fmtDate(r.dueDate) },
              {
                key: 'status',
                label: 'Estado',
                render: (r) => <Pill text={String(r.status)} color={INV_STATUS[String(r.status)] ?? AMBER} />,
              },
            ]}
          />
        )}

        {tab === 'cost-centers' && (
          <DataTable
            exportName="centros-costo"
            rows={cc ?? []}
            emptyText="Sin centros de costo configurados"
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nombre' },
              { key: 'type', label: 'Tipo' },
              { key: 'budgetAmount', label: 'Presupuesto', align: 'right', render: (r) => fmtMoney(r.budgetAmount) },
              { key: 'actualAmount', label: 'Real', align: 'right', render: (r) => fmtMoney(r.actualAmount) },
            ]}
          />
        )}
      </main>
    </div>
  );
}
