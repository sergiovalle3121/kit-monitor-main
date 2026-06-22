'use client';

import { motion, type Variants } from 'framer-motion';
import {
  BarChart3,
  Boxes,
  Building2,
  Database,
  DollarSign,
  Factory,
  FilterX,
  RefreshCw,
  Search,
  ShieldAlert,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { type ReactNode, useMemo, useState, useTransition } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import {
  type CostCategory,
  type CostItem,
  useCostRollup,
} from '@/hooks/useCostRollup';
import { glass } from '@/lib/glass';
import { PageHeader } from '@/components/ui/PageHeader';

type CategoryMeta = {
  label: string;
  color: string;
  tint: string;
  Icon: LucideIcon;
};

type ChartRow = {
  category: CostCategory;
  label: string;
  amount: number;
  percentage: number;
  color: string;
};

const CATEGORY_ORDER: CostCategory[] = [
  'mano_de_obra',
  'materia_prima',
  'energia',
  'gastos_fijos',
];

// Colores categóricos de la visualización (datos, no "chrome"): se mantienen
// porque distinguen las barras/segmentos; el resto de la pantalla usa los
// tokens semánticos del tema (claro/oscuro).
const CATEGORY_META: Record<CostCategory, CategoryMeta> = {
  mano_de_obra: {
    label: 'Mano de obra',
    color: '#f59e0b',
    tint: 'text-amber-500',
    Icon: UsersRound,
  },
  materia_prima: {
    label: 'Materia prima',
    color: '#10b981',
    tint: 'text-emerald-500',
    Icon: Boxes,
  },
  energia: {
    label: 'Energía',
    color: '#3b82f6',
    tint: 'text-blue-500',
    Icon: Zap,
  },
  gastos_fijos: {
    label: 'Gastos fijos',
    color: '#8b5cf6',
    tint: 'text-violet-500',
    Icon: Building2,
  },
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 100 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', damping: 20, stiffness: 100 },
  },
};

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatCompactCurrency(value: number) {
  return compactCurrencyFormatter.format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function CostRollupShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="mx-auto w-full max-w-[1680px] px-4 pt-8 md:px-8 lg:px-10">
        <div className="flex w-full flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

function PremiumSkeleton() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-5 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <motion.div
          key={index}
          variants={cardVariants}
          className={`${glass} h-36 rounded-3xl p-5`}
        >
          <div className="h-4 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
          <div className="mt-8 h-8 w-36 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
          <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-black/5 dark:bg-white/10" />
        </motion.div>
      ))}
      <motion.div
        variants={cardVariants}
        className={`${glass} h-[360px] rounded-3xl p-6 lg:col-span-2`}
      >
        <div className="h-4 w-36 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
        <div className="mx-auto mt-12 h-48 w-48 animate-pulse rounded-full bg-black/5 dark:bg-white/10" />
      </motion.div>
      <motion.div
        variants={cardVariants}
        className={`${glass} h-[360px] rounded-3xl p-6 lg:col-span-2`}
      >
        <div className="h-4 w-36 animate-pulse rounded-full bg-black/10 dark:bg-white/15" />
        <div className="mt-12 grid h-48 grid-cols-4 items-end gap-4">
          {[55, 80, 42, 64].map((height) => (
            <div
              key={height}
              className="animate-pulse rounded-t-2xl bg-black/5 dark:bg-white/10"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccessDenied() {
  return (
    <CostRollupShell>
      <section
        className={`${glass} mx-auto mt-24 max-w-xl rounded-3xl p-8 text-center`}
      >
        <ShieldAlert
          className="mx-auto h-12 w-12 text-red-500"
          strokeWidth={1.5}
        />
        <h1 className="mt-5 text-2xl font-semibold">
          Se requiere acceso a Finanzas
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Este módulo está protegido por RBAC. Pide a un administrador el
          permiso finance:read para ver el costeo por orden.
        </p>
      </section>
    </CostRollupShell>
  );
}

function MetricTile({
  label,
  value,
  detail,
  Icon,
}: {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
}) {
  return (
    <motion.section
      variants={cardVariants}
      whileHover={{ y: -4, borderColor: 'rgba(124,92,255,0.35)' }}
      className={`${glass} rounded-3xl p-5 transition-colors duration-300`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
            {label}
          </p>
          <p className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
            {value}
          </p>
        </div>
        <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
          <Icon className="h-5 w-5 text-violet-500" strokeWidth={1.5} />
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </motion.section>
  );
}

function CategoryBreakdown({ rows }: { rows: ChartRow[] }) {
  return (
    <motion.section variants={cardVariants} className={`${glass} rounded-3xl p-5`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
            Desglose
          </p>
          <h2 className="mt-2 text-lg font-semibold">Categorías de costo</h2>
        </div>
        <BarChart3
          className="h-5 w-5 text-gray-400 dark:text-gray-500"
          strokeWidth={1.5}
        />
      </div>
      <div className="space-y-4">
        {rows.map((row) => {
          const meta = CATEGORY_META[row.category];
          const Icon = meta.Icon;

          return (
            <div key={row.category}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${meta.tint}`}
                    strokeWidth={1.5}
                  />
                  <span className="truncate text-sm text-gray-600 dark:text-gray-300">
                    {row.label}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(row.amount)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {row.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(row.percentage, 100)}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

function CostItemsTable({ items }: { items: CostItem[] }) {
  return (
    <motion.section variants={cardVariants} className={`${glass} rounded-3xl p-5`}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
            Detalle por orden
          </p>
          <h2 className="mt-2 text-lg font-semibold">Registros de costo</h2>
        </div>
        <Database
          className="h-5 w-5 text-gray-400 dark:text-gray-500"
          strokeWidth={1.5}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/5 text-xs uppercase tracking-[0.18em] text-gray-400 dark:border-white/10 dark:text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 font-medium">
                Orden de trabajo
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">
                Categoría
              </th>
              <th className="min-w-[220px] px-3 py-3 font-medium">
                Descripción
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                Monto
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                Registrado
              </th>
            </tr>
          </thead>
          <motion.tbody
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-black/5 dark:divide-white/10"
          >
            {items.map((item) => {
              const meta = CATEGORY_META[item.category];

              return (
                <motion.tr
                  key={item.id}
                  variants={rowVariants}
                  className="text-gray-600 transition-colors duration-300 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-3 py-4 font-medium text-black dark:text-white">
                    {item.workOrderId ?? 'Sin asignar'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <span
                      className="inline-flex items-center rounded-full border border-black/10 px-3 py-1 text-xs font-medium dark:border-white/10"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-4">{item.description}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-right font-semibold text-black dark:text-white">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-gray-400 dark:text-gray-500">
                    {formatDate(item.recordedAt)}
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>
      {!items.length && (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          Ningún registro coincide con este filtro de orden.
        </div>
      )}
    </motion.section>
  );
}

export default function CostRollupPage() {
  const { hasPermission, isLoading: isAuthLoading } = useAuth();
  const [workOrderQuery, setWorkOrderQuery] = useState('');
  const [activeWorkOrder, setActiveWorkOrder] = useState('');
  const [isPending, startTransition] = useTransition();
  const canReadFinance = hasPermission('finance', 'read');
  const { data, error, isLoading, isValidating } = useCostRollup({
    workOrderId: activeWorkOrder,
  });

  const chartRows = useMemo<ChartRow[]>(() => {
    const breakdownByCategory = new Map(
      (data?.breakdown ?? []).map((entry) => [entry.category, entry]),
    );

    return CATEGORY_ORDER.map((category) => {
      const entry = breakdownByCategory.get(category);
      const meta = CATEGORY_META[category];

      return {
        category,
        label: meta.label,
        amount: entry?.amount ?? 0,
        percentage: entry?.percentage ?? 0,
        color: meta.color,
      };
    });
  }, [data?.breakdown]);

  const topCategory = useMemo(() => {
    return chartRows.reduce(
      (winner, row) => (row.amount > winner.amount ? row : winner),
      chartRows[0],
    );
  }, [chartRows]);

  const totalCost = data?.totalCost ?? 0;
  const items = data?.items ?? [];
  const isBusy = isPending || isValidating;

  const handleWorkOrderChange = (value: string) => {
    setWorkOrderQuery(value);
    startTransition(() => {
      setActiveWorkOrder(value.trim());
    });
  };

  const clearWorkOrderFilter = () => {
    setWorkOrderQuery('');
    startTransition(() => {
      setActiveWorkOrder('');
    });
  };

  if (!isAuthLoading && !canReadFinance) {
    return <AccessDenied />;
  }

  return (
    <CostRollupShell>
      <motion.header
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5"
      >
        <motion.div
          variants={cardVariants}
          className="grid gap-5 lg:grid-cols-[1fr_minmax(320px,520px)] lg:items-end"
        >
          <PageHeader
            domain="finance"
            title="Costeo por orden"
            subtitle="Costos por tenant en vivo, agrupados en mano de obra, materiales, energía y overhead."
          />

          <div className={`${glass} rounded-3xl p-3`}>
            <label
              htmlFor="work-order-filter"
              className="mb-2 block px-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500"
            >
              Filtro por orden de trabajo
            </label>
            <div className="flex items-center gap-2">
              <Search
                className="ml-2 h-5 w-5 shrink-0 text-violet-500"
                strokeWidth={1.5}
              />
              <input
                id="work-order-filter"
                value={workOrderQuery}
                onChange={(event) => handleWorkOrderChange(event.target.value)}
                placeholder="Buscar WO-9012"
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              {isBusy && (
                <RefreshCw
                  className="h-4 w-4 animate-spin text-gray-400 dark:text-gray-500"
                  strokeWidth={1.5}
                />
              )}
              {activeWorkOrder && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearWorkOrderFilter}
                  className="rounded-full border border-black/10 bg-black/5 p-2 text-gray-500 transition-colors duration-300 hover:text-black dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white"
                  aria-label="Limpiar filtro de orden"
                >
                  <FilterX className="h-4 w-4" strokeWidth={1.5} />
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.header>

      {isLoading && !data ? (
        <PremiumSkeleton />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {error && (
            <motion.section
              variants={cardVariants}
              className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-600 dark:text-red-300"
            >
              No se pudieron cargar los datos de costeo. Verifica que la API esté
              corriendo y que tu token incluya finance:read.
            </motion.section>
          )}

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Costo total"
              value={formatCurrency(totalCost)}
              detail={
                activeWorkOrder
                  ? `Filtrado por ${activeWorkOrder}`
                  : 'Todas las órdenes visibles'
              }
              Icon={DollarSign}
            />
            <MetricTile
              label="Mayor categoría"
              value={topCategory?.label ?? 'Sin datos'}
              detail={formatCurrency(topCategory?.amount ?? 0)}
              Icon={Factory}
            />
            <MetricTile
              label="Registros de costo"
              value={String(items.length)}
              detail="Movimientos del libro por tenant"
              Icon={Database}
            />
            <MetricTile
              label="Filtro activo"
              value={activeWorkOrder || 'Todas las WO'}
              detail="Se actualiza con la revalidación SWR"
              Icon={Search}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr_1fr]">
            <CategoryBreakdown rows={chartRows} />

            <motion.section
              variants={cardVariants}
              className={`${glass} rounded-3xl p-5`}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    Distribución
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    Por categoría (pastel)
                  </h2>
                </div>
                <DollarSign
                  className="h-5 w-5 text-gray-400 dark:text-gray-500"
                  strokeWidth={1.5}
                />
              </div>
              <div className="h-[320px] min-h-[320px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height={310}
                  minWidth={260}
                  minHeight={260}
                  initialDimension={{ width: 520, height: 310 }}
                >
                  <PieChart>
                    <Pie
                      data={chartRows}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={112}
                      paddingAngle={4}
                      dataKey="amount"
                      nameKey="label"
                    >
                      {chartRows.map((row) => (
                        <Cell
                          key={row.category}
                          fill={row.color}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '16px',
                        color: 'hsl(var(--popover-foreground))',
                        backdropFilter: 'blur(18px)',
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        'Costo',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {chartRows.map((row) => (
                  <div
                    key={row.category}
                    className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate">{row.label}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section
              variants={cardVariants}
              className={`${glass} rounded-3xl p-5`}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                    Comparativo
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    Por categoría (barras)
                  </h2>
                </div>
                <BarChart3
                  className="h-5 w-5 text-gray-400 dark:text-gray-500"
                  strokeWidth={1.5}
                />
              </div>
              <div className="h-[320px] min-h-[320px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height={310}
                  minWidth={260}
                  minHeight={260}
                  initialDimension={{ width: 520, height: 310 }}
                >
                  <BarChart
                    data={chartRows}
                    margin={{ top: 16, right: 10, left: -18, bottom: 12 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(value) =>
                        formatCompactCurrency(Number(value))
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '16px',
                        color: 'hsl(var(--popover-foreground))',
                        backdropFilter: 'blur(18px)',
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        'Costo',
                      ]}
                    />
                    <Bar dataKey="amount" radius={[14, 14, 4, 4]}>
                      {chartRows.map((row) => (
                        <Cell key={row.category} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </section>

          {activeWorkOrder && <CostItemsTable items={items} />}
        </motion.div>
      )}
    </CostRollupShell>
  );
}
