"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  Cpu,
  Factory,
  Gauge,
  Layers3,
  RadioTower,
  ShieldCheck,
  Sigma,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  PlantFloor,
  type PlantFloorBay,
} from "@/components/digital-twin/PlantFloor";
import {
  SigmaChart,
  type SigmaPoint,
} from "@/components/analytics/SigmaChart";
import { AutopilotHud } from "@/components/dashboard/AutopilotHud";

const spring = { type: "spring", damping: 20, stiffness: 100 } as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { ...spring, staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const plantHealthScore = 87;

const kpis = [
  {
    label: "Output",
    value: "18.4k",
    delta: "+7.8%",
    icon: Factory,
    accent: "#00F2EA",
    sparkline: [42, 48, 47, 55, 61, 59, 72, 78, 82, 88],
  },
  {
    label: "Quality Sigma",
    value: "4.72",
    delta: "+0.18",
    icon: ShieldCheck,
    accent: "#FFB800",
    sparkline: [61, 64, 63, 66, 70, 69, 73, 72, 76, 78],
  },
  {
    label: "Cost Rollup",
    value: "$41.82",
    delta: "-3.1%",
    icon: WalletCards,
    accent: "#FF005C",
    sparkline: [88, 84, 81, 79, 74, 72, 68, 63, 61, 58],
  },
];

const monteCarloTimeline = [
  { day: "Mon", p50: 82, p90: 94, risk: "stable", cost: 39.8 },
  { day: "Tue", p50: 79, p90: 92, risk: "stable", cost: 40.1 },
  { day: "Wed", p50: 74, p90: 89, risk: "watch", cost: 41.6 },
  { day: "Thu", p50: 68, p90: 84, risk: "constraint", cost: 43.2 },
  { day: "Fri", p50: 72, p90: 86, risk: "watch", cost: 42.5 },
  { day: "Sat", p50: 77, p90: 90, risk: "stable", cost: 40.9 },
  { day: "Sun", p50: 81, p90: 93, risk: "stable", cost: 39.6 },
];

const plantBays: PlantFloorBay[] = [
  {
    id: 1,
    model: "AX-Core",
    partNumber: "AX-CTRL-100",
    bahia: 1,
    minStock: 120,
    state: "running",
    currentWo: "WO-9031",
    sigmaLevel: 4.91,
    throughput: 128,
  },
  {
    id: 2,
    model: "AX-Core",
    partNumber: "AX-CHS-210",
    bahia: 2,
    minStock: 80,
    state: "running",
    currentWo: "WO-9031",
    sigmaLevel: 4.76,
    throughput: 121,
  },
  {
    id: 3,
    model: "AX-Core",
    partNumber: "AX-PWR-040",
    bahia: 3,
    minStock: 60,
    state: "bottleneck",
    currentWo: "WO-9034",
    sigmaLevel: 3.82,
    throughput: 74,
  },
  {
    id: 4,
    model: "AX-Core",
    partNumber: "AX-HMI-018",
    bahia: 4,
    minStock: 90,
    state: "running",
    currentWo: "WO-9032",
    sigmaLevel: 4.68,
    throughput: 116,
  },
  {
    id: 5,
    model: "AX-Core",
    partNumber: "AX-SNS-122",
    bahia: 5,
    minStock: 45,
    state: "idle",
    currentWo: "Queued",
    sigmaLevel: 4.1,
    throughput: 0,
  },
  {
    id: 6,
    model: "AX-Core",
    partNumber: "AX-FNL-310",
    bahia: 6,
    minStock: 100,
    state: "running",
    currentWo: "WO-9033",
    sigmaLevel: 4.86,
    throughput: 132,
  },
];

const sigmaSeries: SigmaPoint[] = [
  { sample: "S1", mean: 10.2, range: 1.1 },
  { sample: "S2", mean: 10.4, range: 1.4 },
  { sample: "S3", mean: 9.9, range: 1.2 },
  { sample: "S4", mean: 10.1, range: 1.3 },
  { sample: "S5", mean: 10.6, range: 1.8 },
  { sample: "S6", mean: 10.3, range: 1.5 },
  { sample: "S7", mean: 11.8, range: 2.9 },
  { sample: "S8", mean: 10.2, range: 1.2 },
  { sample: "S9", mean: 9.7, range: 1.6 },
  { sample: "S10", mean: 10.5, range: 1.4 },
  { sample: "S11", mean: 10.1, range: 1.1 },
  { sample: "S12", mean: 8.9, range: 2.7 },
];

function buildSparklinePath(values: number[]) {
  const width = 138;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function GlobalRiskPulse({ score }: { score: number }) {
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const pulseSpeed = Math.max(1.5, 4 - score / 40);

  return (
    <motion.div
      variants={cardVariants}
      className="premium-glass relative overflow-hidden rounded-[var(--border-radius-custom)] p-6 text-white shadow-2xl shadow-black/40"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,242,234,0.18),transparent_52%)]" />
      <div className="relative flex flex-col items-center justify-center gap-5 xl:flex-row">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <motion.div
            className="absolute h-52 w-52 rounded-full border border-[var(--brand-primary)]/25"
            animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.35, 0.78, 0.35] }}
            transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
          />
          <svg className="h-56 w-56 -rotate-90" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="14"
            />
            <motion.circle
              cx="110"
              cy="110"
              r={radius}
              fill="transparent"
              stroke="var(--brand-primary)"
              strokeLinecap="round"
              strokeWidth="14"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={spring}
              filter="drop-shadow(0 0 18px rgba(0,242,234,0.75))"
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.32em] text-white/45">
              Plant Health
            </p>
            <p className="mt-2 text-6xl font-semibold tracking-tight">{score}</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <Activity className="h-5 w-5 text-[var(--brand-primary)]" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold">Risk pulse nominal</p>
              <p className="text-xs text-white/45">One active bottleneck within tolerance band</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["OEE", "88.1"],
              ["FPY", "96.4"],
              ["Cash", "1.7M"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-lg font-semibold">{value}</p>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function KpiTile({ tile }: { tile: (typeof kpis)[number] }) {
  const Icon = tile.icon;
  const path = buildSparklinePath(tile.sparkline);

  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={spring}
      className="premium-glass rounded-[var(--border-radius-custom)] p-5 text-white shadow-2xl shadow-black/30"
    >
      <div className="flex items-start justify-between">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: tile.accent }} />
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
          {tile.delta}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">{tile.label}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">{tile.value}</p>
        </div>
        <svg viewBox="0 0 138 48" className="h-12 w-36 overflow-visible">
          <motion.path
            d={path}
            fill="none"
            stroke={tile.accent}
            strokeLinecap="round"
            strokeWidth="2.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
      </div>
    </motion.article>
  );
}

export default function MissionControlPage() {
  const [selectedDayIndex, setSelectedDayIndex] = useState(3);
  const [chartMode, setChartMode] = useState<"xbar" | "range">("xbar");
  const [isPending, startTransition] = useTransition();
  const selectedDay = monteCarloTimeline[selectedDayIndex];

  const activeBottlenecks = useMemo(
    () => plantBays.filter((bay) => bay.state === "bottleneck").length,
    [],
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#020409] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,242,234,0.18),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(255,0,92,0.12),transparent_24%),linear-gradient(135deg,#020409_0%,#071018_48%,#020409_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
      
      <AutopilotHud />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10"
      >
        <motion.header
          variants={cardVariants}
          className="premium-glass flex flex-col gap-4 rounded-[var(--border-radius-custom)] px-5 py-4 text-white shadow-2xl shadow-black/30 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/70 transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)]/50 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45">
                <RadioTower className="h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
                AXOS Nexus
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
                Mission Control
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:w-[520px]">
            {[
              ["Risk", activeBottlenecks.toString(), AlertTriangle],
              ["Sigma", "4.72", Sigma],
              ["Cost", "$41.82", WalletCards],
            ].map(([label, value, Icon]) => (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                {typeof Icon !== "string" ? (
                  <Icon className="mb-3 h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
                ) : null}
                <p className="text-lg font-semibold">{value as string}</p>
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-white/40">{label as string}</p>
              </div>
            ))}
          </div>
        </motion.header>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_1.92fr]">
          <GlobalRiskPulse score={plantHealthScore} />

          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {kpis.map((tile) => (
              <KpiTile key={tile.label} tile={tile} />
            ))}
          </motion.div>
        </section>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.35fr_0.95fr]">
          <PlantFloor bays={plantBays} />

          <motion.section
            variants={cardVariants}
            className="premium-glass rounded-[var(--border-radius-custom)] p-5 text-white shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45">
                  Monte Carlo
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Predictive Timeline</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
                <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
                7 day horizon
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-[720px] items-end gap-3">
                {monteCarloTimeline.map((day, index) => {
                  const selected = index === selectedDayIndex;
                  const riskColor =
                    day.risk === "constraint"
                      ? "#FF005C"
                      : day.risk === "watch"
                        ? "#FFB800"
                        : "#00F2EA";

                  return (
                    <motion.button
                      key={day.day}
                      type="button"
                      variants={cardVariants}
                      whileHover={{ y: -4 }}
                      transition={spring}
                      onClick={() => {
                        startTransition(() => setSelectedDayIndex(index));
                      }}
                      className={`h-52 flex-1 rounded-3xl border p-3 text-left transition ${
                        selected
                          ? "border-[var(--brand-primary)] bg-white/[0.08]"
                          : "border-white/10 bg-black/25 hover:border-white/20"
                      }`}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <div>
                          <p className="text-sm font-semibold">{day.day}</p>
                          <p className="mt-1 text-xs text-white/42">p90 {day.p90}%</p>
                        </div>
                        <div className="flex h-28 items-end gap-2">
                          <div className="w-1/2 rounded-t-xl bg-white/10" style={{ height: `${day.p90}%` }} />
                          <motion.div
                            className="w-1/2 rounded-t-xl"
                            style={{ height: `${day.p50}%`, backgroundColor: riskColor }}
                            animate={{ opacity: selected ? [0.72, 1, 0.72] : 0.72 }}
                            transition={{ duration: 1.8, repeat: selected ? Infinity : 0 }}
                          />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-white/38">{day.risk}</p>
                          <p className="text-sm font-semibold">${day.cost.toFixed(2)}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Selected", selectedDay.day],
                ["p50 Output", `${selectedDay.p50}%`],
                ["p90 Output", `${selectedDay.p90}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-[0.62rem] uppercase tracking-[0.18em] text-white/38">{label}</p>
                  <p className="mt-2 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {isPending ? (
              <p className="mt-3 text-xs text-[var(--brand-primary)]">Rebalancing projection...</p>
            ) : null}
          </motion.section>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <SigmaChart
            title={chartMode === "xbar" ? "X-bar Chart" : "R Chart"}
            data={sigmaSeries}
            mode={chartMode}
          />

          <motion.section
            variants={cardVariants}
            className="premium-glass rounded-[var(--border-radius-custom)] p-5 text-white shadow-2xl shadow-black/30"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45">
                  Command Actions
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Signal Routing</h2>
              </div>
              <Cpu className="h-5 w-5 text-[var(--brand-primary)]" strokeWidth={1.5} />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              {(["xbar", "range"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => startTransition(() => setChartMode(mode))}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    chartMode === mode
                      ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/12 text-white"
                      : "border-white/10 bg-black/30 text-white/60 hover:text-white"
                  }`}
                >
                  {mode === "xbar" ? "X-bar" : "R Chart"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {[
                ["Constraint", "Bay 3 throughput below p50 envelope", AlertTriangle, "#FFB800"],
                ["Quality", "Two samples outside 3-sigma band", ShieldCheck, "#FF005C"],
                ["Cost", "Rollup variance improving against plan", Gauge, "#00F2EA"],
                ["Twin", "Six BayLayout nodes mapped to SVG", Layers3, "#00F2EA"],
              ].map(([label, value, Icon, color]) => (
                <motion.div
                  key={label as string}
                  variants={cardVariants}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  {typeof Icon !== "string" ? (
                    <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: color as string }} />
                  ) : null}
                  <div>
                    <p className="text-sm font-semibold">{label as string}</p>
                    <p className="text-xs text-white/45">{value as string}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </section>
      </motion.div>
    </main>
  );
}
