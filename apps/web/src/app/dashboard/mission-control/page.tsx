"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ChevronLeft,
  Factory,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  PlantFloor,
  type PlantFloorBay,
} from "@/components/digital-twin/PlantFloor";
import { AutopilotHud } from "@/components/dashboard/AutopilotHud";
import { useAuth } from "@/hooks/useAuth";
import { useCostRollup } from "@/hooks/useCostRollup";

type ProductionWip = {
  id: number;
  workOrder: string;
  partNumber: string;
  targetQty: number;
  completedQty: number;
  scrapQty: number;
  status: "in_production" | "completed" | "on_hold" | "ready_for_fg";
  line: string | null;
  building: string | null;
  program: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

type ApiEnvelope<T> = T | { success: boolean; data: T; timestamp?: string };

type MetricTileProps = {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  color: string;
};

const spring = { type: "spring", damping: 24, stiffness: 90 } as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const emptyOperationsMessage =
  "No hay operaciones activas actualmente. El sistema está listo para recibir el primer lote de producción.";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function unwrapResponse<T>(payload: ApiEnvelope<T>): T {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    "data" in payload
  ) {
    return payload.data;
  }

  return payload;
}

async function fetchProductionWip(
  url: string,
  tenantId: string,
): Promise<ProductionWip[]> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("axos_access_token")
      : null;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Unable to load production WIP.");
  }

  const payload = (await response.json()) as ApiEnvelope<ProductionWip[]>;
  return unwrapResponse(payload);
}

function useProductionWip() {
  const { tenantId, hasPermission, isLoading: isAuthLoading } = useAuth();
  const canReadProduction = hasPermission("production", "read");
  const shouldFetch = !isAuthLoading && canReadProduction && Boolean(tenantId);
  const key = shouldFetch
    ? ([`${apiBaseUrl}/api/production-runtime/wip`, tenantId as string] as const)
    : null;

  return useSWR<ProductionWip[], Error>(
    key,
    ([url, scopedTenantId]: readonly [string, string]) =>
      fetchProductionWip(url, scopedTenantId),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(Number(value) || 0));
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

function completionPercent(wip: ProductionWip) {
  return wip.targetQty > 0
    ? Math.min(100, Math.max(0, (wip.completedQty / wip.targetQty) * 100))
    : null;
}

function mapWipState(status: ProductionWip["status"]): PlantFloorBay["state"] {
  if (status === "on_hold") return "bottleneck";
  if (status === "in_production") return "running";
  return "idle";
}

function EmptyState() {
  return (
    <motion.section
      variants={cardVariants}
      className="apple-card rounded-[28px] p-8 text-center"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0071e3]/10">
        <Sparkles className="h-6 w-6 text-[#0071e3]" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#1d1d1f]">
        Operaciones en espera
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#86868b]">
        {emptyOperationsMessage}
      </p>
    </motion.section>
  );
}

function GlobalRiskPulse({ score }: { score: number | null }) {
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score ?? 0;
  const offset = circumference - (normalizedScore / 100) * circumference;

  return (
    <motion.section
      variants={cardVariants}
      className="apple-card rounded-[28px] p-6"
    >
      <div className="flex flex-col items-center justify-center gap-6 xl:flex-row">
        <div className="relative flex h-60 w-60 items-center justify-center">
          {score !== null ? (
            <motion.div
              className="absolute h-48 w-48 rounded-full border border-[#34c759]/20"
              animate={{ scale: [0.96, 1.03, 0.96], opacity: [0.42, 0.68, 0.42] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
          <svg className="h-52 w-52 -rotate-90" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke="rgba(0,0,0,0.07)"
              strokeWidth="12"
            />
            <motion.circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke={score === null ? "rgba(134,134,139,0.32)" : "#34c759"}
              strokeLinecap="round"
              strokeWidth="12"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={spring}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#86868b]">
              Plant Health
            </p>
            <p className="mt-2 text-6xl font-semibold tracking-tight text-[#1d1d1f]">
              {score === null ? "—" : Math.round(score)}
            </p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-[#34c759]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {score === null ? "Sin WIP activo" : "Pulso calculado"}
                </p>
                <p className="text-xs text-[#86868b]">
                  Basado en avance real, scrap y órdenes en hold.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm leading-6 text-[#86868b]">
            La lectura se deriva del estado actual de producción; cuando no hay
            WIP activo, el tablero permanece en espera sin estimaciones.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function MetricTile({ label, value, detail, Icon, color }: MetricTileProps) {
  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={spring}
      className="apple-card rounded-[28px] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#86868b]">
            {label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            {value}
          </p>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{ backgroundColor: `${color}16` }}
        >
          <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color }} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-5 text-[#86868b]">{detail}</p>
    </motion.article>
  );
}

function WipTimeline({ wips }: { wips: ProductionWip[] }) {
  return (
    <motion.section
      variants={cardVariants}
      className="apple-card rounded-[28px] p-5"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#86868b]">
            Live WIP
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            Production timeline
          </h2>
        </div>
        <RadioTower className="h-5 w-5 text-[#0071e3]" strokeWidth={1.5} />
      </div>

      {wips.length ? (
        <div className="space-y-3">
          {wips.map((wip) => {
            const progress = completionPercent(wip);
            const statusColor =
              wip.status === "on_hold"
                ? "#ff9500"
                : wip.status === "in_production"
                  ? "#34c759"
                  : "#0071e3";

            return (
              <motion.div
                key={wip.id}
                variants={cardVariants}
                className="rounded-3xl border border-black/[0.06] bg-white/72 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">
                      {wip.workOrder}
                    </p>
                    <p className="mt-1 text-xs text-[#86868b]">
                      {wip.partNumber}
                      {wip.line ? ` · ${wip.line}` : ""}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: `${statusColor}14`,
                      color: statusColor,
                    }}
                  >
                    {wip.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress ?? 0}%` }}
                    transition={spring}
                    className="h-full rounded-full"
                    style={{ backgroundColor: statusColor }}
                  />
                </div>
                <div className="mt-3 flex justify-between text-xs text-[#86868b]">
                  <span>
                    {formatNumber(wip.completedQty)} / {formatNumber(wip.targetQty)}
                  </span>
                  <span>{progress === null ? "Sin objetivo" : `${progress.toFixed(1)}%`}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-black/[0.08] bg-white/58 p-6 text-sm leading-6 text-[#86868b]">
          {emptyOperationsMessage}
        </div>
      )}
    </motion.section>
  );
}

export default function MissionControlPage() {
  const { isLoading: isAuthLoading, hasPermission } = useAuth();
  const {
    data: wips = [],
    error: wipError,
    isLoading: isWipLoading,
  } = useProductionWip();
  const { data: costRollup } = useCostRollup();
  const canReadProduction = hasPermission("production", "read");
  const canReadFinance = hasPermission("finance", "read");

  const summary = useMemo(() => {
    const totalTarget = wips.reduce((sum, wip) => sum + Number(wip.targetQty || 0), 0);
    const completed = wips.reduce((sum, wip) => sum + Number(wip.completedQty || 0), 0);
    const scrap = wips.reduce((sum, wip) => sum + Number(wip.scrapQty || 0), 0);
    const onHold = wips.filter((wip) => wip.status === "on_hold").length;
    const readyForFg = wips.filter((wip) => wip.status === "ready_for_fg").length;
    const progress = totalTarget > 0 ? (completed / totalTarget) * 100 : null;
    const scrapRate = completed + scrap > 0 ? (scrap / (completed + scrap)) * 100 : 0;
    const health =
      wips.length && progress !== null
        ? Math.max(0, Math.min(100, progress - onHold * 8 - scrapRate * 1.4))
        : null;

    return {
      totalTarget,
      completed,
      scrap,
      onHold,
      readyForFg,
      progress,
      health,
    };
  }, [wips]);

  const plantFloorBays = useMemo<PlantFloorBay[]>(
    () =>
      wips.map((wip, index) => ({
        id: wip.id,
        model: wip.partNumber,
        partNumber: wip.partNumber,
        bahia: index + 1,
        state: mapWipState(wip.status),
        currentWo: wip.workOrder,
        sigmaLevel: null,
        throughput: null,
        completionPercent: completionPercent(wip),
      })),
    [wips],
  );

  const isLoading = isAuthLoading || isWipLoading;
  const hasOperations = wips.length > 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <AutopilotHud />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10"
      >
        <motion.header
          variants={cardVariants}
          className="apple-card flex flex-col gap-4 rounded-[28px] px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-black/[0.06] bg-white/70 p-3 text-[#86868b] transition hover:-translate-y-0.5 hover:text-[#0071e3]"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#86868b]">
                <RadioTower className="h-4 w-4 text-[#0071e3]" strokeWidth={1.5} />
                AXOS Nexus
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d1d1f] md:text-5xl">
                Mission Control
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:w-[520px]">
            <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-3">
              <AlertCircle className="mb-3 h-4 w-4 text-[#ff9500]" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-[#1d1d1f]">
                {hasOperations ? summary.onHold : "—"}
              </p>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#86868b]">
                Hold
              </p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-3">
              <ShieldCheck className="mb-3 h-4 w-4 text-[#34c759]" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-[#1d1d1f]">
                {hasOperations && summary.progress !== null
                  ? `${summary.progress.toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#86868b]">
                Progress
              </p>
            </div>
            <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-3">
              <WalletCards className="mb-3 h-4 w-4 text-[#0071e3]" strokeWidth={1.5} />
              <p className="text-lg font-semibold text-[#1d1d1f]">
                {canReadFinance && costRollup
                  ? formatCurrency(costRollup.totalCost)
                  : "—"}
              </p>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#86868b]">
                Cost
              </p>
            </div>
          </div>
        </motion.header>

        {!canReadProduction && !isAuthLoading ? (
          <motion.section
            variants={cardVariants}
            className="apple-card rounded-[28px] p-6 text-sm text-[#86868b]"
          >
            Se requiere el permiso production:read para cargar operaciones en
            vivo.
          </motion.section>
        ) : null}

        {wipError ? (
          <motion.section
            variants={cardVariants}
            className="apple-card rounded-[28px] p-6 text-sm text-[#86868b]"
          >
            No se pudo cargar /api/production-runtime/wip. El tablero queda sin
            datos simulados.
          </motion.section>
        ) : null}

        {isLoading ? (
          <motion.section
            variants={cardVariants}
            className="apple-card rounded-[28px] p-8"
          >
            <div className="h-4 w-44 animate-pulse rounded-full bg-black/10" />
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl bg-black/[0.04]" />
              ))}
            </div>
          </motion.section>
        ) : canReadProduction && !wipError ? (
          <>
            {!hasOperations ? <EmptyState /> : null}

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_1.92fr]">
              <GlobalRiskPulse score={summary.health} />

              <motion.div
                variants={containerVariants}
                className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4"
              >
                <MetricTile
                  label="Output"
                  value={hasOperations ? formatNumber(summary.completed) : "—"}
                  detail="Unidades completadas reportadas por WIP."
                  Icon={Factory}
                  color="#0071e3"
                />
                <MetricTile
                  label="Active WIP"
                  value={hasOperations ? formatNumber(wips.length) : "—"}
                  detail="Órdenes vivas recibidas desde production-runtime."
                  Icon={Activity}
                  color="#34c759"
                />
                <MetricTile
                  label="Ready for FG"
                  value={hasOperations ? formatNumber(summary.readyForFg) : "—"}
                  detail="Lotes listos para declaración de producto terminado."
                  Icon={PackageCheck}
                  color="#ff9500"
                />
                <MetricTile
                  label="Cost Rollup"
                  value={
                    canReadFinance && costRollup
                      ? formatCurrency(costRollup.totalCost)
                      : "—"
                  }
                  detail={
                    canReadFinance
                      ? "Total real del módulo de costos."
                      : "Requiere finance:read."
                  }
                  Icon={WalletCards}
                  color="#0071e3"
                />
              </motion.div>
            </section>

            <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.35fr_0.95fr]">
              <PlantFloor bays={plantFloorBays} />
              <WipTimeline wips={wips} />
            </section>
          </>
        ) : null}
      </motion.div>
    </main>
  );
}
