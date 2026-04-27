'use client';

import { motion, type Variants } from 'framer-motion';
import {
  ArrowLeft,
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
import Link from 'next/link';
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

const CATEGORY_META: Record<CostCategory, CategoryMeta> = {
  mano_de_obra: {
    label: 'Mano de Obra',
    color: '#FFB800',
    tint: 'text-amber-300',
    Icon: UsersRound,
  },
  materia_prima: {
    label: 'Materia Prima',
    color: '#10B981',
    tint: 'text-emerald-300',
    Icon: Boxes,
  },
  energia: {
    label: 'Energia',
    color: '#3B82F6',
    tint: 'text-blue-300',
    Icon: Zap,
  },
  gastos_fijos: {
    label: 'Gastos Fijos',
    color: '#8B5CF6',
    tint: 'text-violet-300',
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
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function CostRollupShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(0,242,234,0.14),transparent_34%),linear-gradient(135deg,#050505_0%,#101010_48%,#050505_100%)] px-4 py-6 text-white md:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        {children}
      </div>
    </main>
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
          className="h-36 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
        >
          <div className="h-4 w-24 animate-pulse rounded-full bg-white/20" />
          <div className="mt-8 h-8 w-36 animate-pulse rounded-full bg-white/15" />
          <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-white/10" />
        </motion.div>
      ))}
      <motion.div
        variants={cardVariants}
        className="h-[360px] rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl lg:col-span-2"
      >
        <div className="h-4 w-36 animate-pulse rounded-full bg-white/20" />
        <div className="mx-auto mt-12 h-48 w-48 animate-pulse rounded-full bg-white/10" />
      </motion.div>
      <motion.div
        variants={cardVariants}
        className="h-[360px] rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl lg:col-span-2"
      >
        <div className="h-4 w-36 animate-pulse rounded-full bg-white/20" />
        <div className="mt-12 grid h-48 grid-cols-4 items-end gap-4">
          {[55, 80, 42, 64].map((height) => (
            <div
              key={height}
              className="animate-pulse rounded-t-2xl bg-white/10"
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
      <section className="mx-auto mt-24 max-w-xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
        <ShieldAlert
          className="mx-auto h-12 w-12 text-[#FF005C]"
          strokeWidth={1.5}
        />
        <h1 className="mt-5 text-2xl font-semibold">Finance access required</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          This module is protected by RBAC. Ask an administrator for the
          finance:read permission to view cost rollup data.
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
      whileHover={{ y: -4, borderColor: 'rgba(0,242,234,0.36)' }}
      className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl transition-colors duration-300"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            {label}
          </p>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {value}
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
          <Icon className="h-5 w-5 text-[#00F2EA]" strokeWidth={1.5} />
        </div>
      </div>
      <p className="mt-4 text-sm text-white/55">{detail}</p>
    </motion.section>
  );
}

function CategoryBreakdown({ rows }: { rows: ChartRow[] }) {
  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Breakdown
          </p>
          <h2 className="mt-2 text-lg font-semibold">Cost categories</h2>
        </div>
        <BarChart3 className="h-5 w-5 text-white/50" strokeWidth={1.5} />
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
                  <span className="truncate text-sm text-white/78">
                    {row.label}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {formatCurrency(row.amount)}
                  </p>
                  <p className="text-xs text-white/45">
                    {row.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
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
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Work Order Drilldown
          </p>
          <h2 className="mt-2 text-lg font-semibold">Individual cost records</h2>
        </div>
        <Database className="h-5 w-5 text-white/50" strokeWidth={1.5} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-white/42">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 font-medium">
                Work Order
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">
                Category
              </th>
              <th className="min-w-[220px] px-3 py-3 font-medium">
                Description
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                Amount
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                Recorded
              </th>
            </tr>
          </thead>
          <motion.tbody
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-white/10"
          >
            {items.map((item) => {
              const meta = CATEGORY_META[item.category];

              return (
                <motion.tr
                  key={item.id}
                  variants={rowVariants}
                  className="text-white/72 transition-colors duration-300 hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-3 py-4 font-medium text-white">
                    {item.workOrderId ?? 'Unassigned'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    <span
                      className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-xs font-medium"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-white/68">
                    {item.description}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right font-semibold text-white">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-right text-white/48">
                    {formatDate(item.recordedAt)}
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>
      {!items.length && (
        <div className="py-12 text-center text-sm text-white/55">
          No cost records match this work order filter.
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
        className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl md:p-6"
      >
        <motion.div variants={cardVariants} className="flex flex-wrap gap-3">
          <Link href="/dashboard/finance">
            <motion.span
              whileHover={{ x: -3, borderColor: 'rgba(0,242,234,0.35)' }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm text-white/76 transition-colors duration-300"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Finance Hub
            </motion.span>
          </Link>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="mt-6 grid gap-5 lg:grid-cols-[1fr_minmax(320px,520px)] lg:items-end"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00F2EA]/75">
              Industrial Accounting
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Cost Rollup Command Desk
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60 md:text-base">
              Live tenant-scoped costs grouped by labor, materials, energy, and
              fixed overhead.
            </p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-black/25 p-3 backdrop-blur-xl">
            <label
              htmlFor="work-order-filter"
              className="mb-2 block px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45"
            >
              Work Order Filter
            </label>
            <div className="flex items-center gap-2">
              <Search
                className="ml-2 h-5 w-5 shrink-0 text-[#00F2EA]"
                strokeWidth={1.5}
              />
              <input
                id="work-order-filter"
                value={workOrderQuery}
                onChange={(event) => handleWorkOrderChange(event.target.value)}
                placeholder="Search WO-9012"
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-white/32"
              />
              {isBusy && (
                <RefreshCw
                  className="h-4 w-4 animate-spin text-white/45"
                  strokeWidth={1.5}
                />
              )}
              {activeWorkOrder && (
                <motion.button
                  type="button"
                  whileHover={{
                    scale: 1.05,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                  whileTap={{ scale: 0.95 }}
                  onClick={clearWorkOrderFilter}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-colors duration-300"
                  aria-label="Clear work order filter"
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
              className="rounded-3xl border border-[#FF005C]/30 bg-[#FF005C]/10 p-5 text-sm text-rose-100 shadow-2xl shadow-black/25 backdrop-blur-xl"
            >
              Cost rollup data could not be loaded. Confirm that the API is
              running and that your token includes finance:read.
            </motion.section>
          )}

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Total Cost"
              value={formatCurrency(totalCost)}
              detail={
                activeWorkOrder
                  ? `Filtered by ${activeWorkOrder}`
                  : 'All visible work orders'
              }
              Icon={DollarSign}
            />
            <MetricTile
              label="Largest Bucket"
              value={topCategory?.label ?? 'No Data'}
              detail={formatCurrency(topCategory?.amount ?? 0)}
              Icon={Factory}
            />
            <MetricTile
              label="Cost Records"
              value={String(items.length)}
              detail="Tenant-scoped ledger items"
              Icon={Database}
            />
            <MetricTile
              label="Active Filter"
              value={activeWorkOrder || 'All WOs'}
              detail="Updates through SWR revalidation"
              Icon={Search}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr_1fr]">
            <CategoryBreakdown rows={chartRows} />

            <motion.section
              variants={cardVariants}
              className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                    Pie Rollup
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    Category distribution
                  </h2>
                </div>
                <DollarSign
                  className="h-5 w-5 text-white/50"
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
                          stroke="rgba(255,255,255,0.16)"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.86)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '16px',
                        color: 'white',
                        backdropFilter: 'blur(18px)',
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        'Cost',
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {chartRows.map((row) => (
                  <div
                    key={row.category}
                    className="flex items-center gap-2 text-xs text-white/60"
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
              className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/25 backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                    Bar Rollup
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    Cost comparison
                  </h2>
                </div>
                <BarChart3
                  className="h-5 w-5 text-white/50"
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
                      stroke="rgba(255,255,255,0.07)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: 'rgba(255,255,255,0.52)', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.52)', fontSize: 11 }}
                      tickFormatter={(value) =>
                        formatCompactCurrency(Number(value))
                      }
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{
                        background: 'rgba(0,0,0,0.86)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '16px',
                        color: 'white',
                        backdropFilter: 'blur(18px)',
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        'Cost',
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
