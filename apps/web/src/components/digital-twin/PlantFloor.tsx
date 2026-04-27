"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Gauge, RadioTower } from "lucide-react";

export type PlantFloorBayState = "running" | "bottleneck" | "idle";

export type PlantFloorBay = {
  id: number | string;
  model: string;
  partNumber: string;
  bahia: number;
  minStock?: number | null;
  state: PlantFloorBayState;
  currentWo: string;
  sigmaLevel?: number | null;
  throughput?: number | null;
  completionPercent?: number | null;
};

type PlantFloorProps = {
  bays: PlantFloorBay[];
};

const spring = { type: "spring", damping: 24, stiffness: 90 } as const;

const emptyOperationsMessage =
  "No hay operaciones activas actualmente. El sistema está listo para recibir el primer lote de producción.";

const stateStyles: Record<
  PlantFloorBayState,
  { fill: string; stroke: string; aura: string; label: string }
> = {
  running: {
    fill: "rgba(52, 199, 89, 0.14)",
    stroke: "#34c759",
    aura: "rgba(52, 199, 89, 0.2)",
    label: "Running",
  },
  bottleneck: {
    fill: "rgba(255, 149, 0, 0.16)",
    stroke: "#ff9500",
    aura: "rgba(255, 149, 0, 0.24)",
    label: "Bottleneck",
  },
  idle: {
    fill: "rgba(134, 134, 139, 0.08)",
    stroke: "rgba(134, 134, 139, 0.42)",
    aura: "rgba(134, 134, 139, 0.12)",
    label: "Idle",
  },
};

function bayCoordinates(index: number) {
  const row = Math.floor(index / 3);
  const column = index % 3;
  return {
    x: 78 + column * 214,
    y: 88 + row * 156,
  };
}

function formatPercent(value?: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "Sin datos";
}

export function PlantFloor({ bays }: PlantFloorProps) {
  const [activeBayId, setActiveBayId] = useState<number | string | null>(null);
  const orderedBays = useMemo(
    () => [...bays].sort((a, b) => a.bahia - b.bahia),
    [bays],
  );
  const activeBay = orderedBays.find((bay) => bay.id === activeBayId);

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { ...spring, staggerChildren: 0.05 },
        },
      }}
      className="apple-card relative overflow-hidden rounded-[28px] p-5"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[#86868b]">
            Industrial Digital Twin
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            Plant Floor V1.0
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-3 py-2 text-xs text-[#86868b]">
          <RadioTower className="h-4 w-4 text-[#0071e3]" strokeWidth={1.5} />
          Live telemetry
        </div>
      </div>

      {!orderedBays.length ? (
        <div className="rounded-3xl border border-dashed border-black/[0.08] bg-white/58 p-8 text-center text-sm leading-6 text-[#86868b]">
          {emptyOperationsMessage}
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox="0 0 720 430"
            role="img"
            aria-label="Plant floor digital twin"
            className="h-auto w-full"
          >
            <defs>
              <filter id="appleSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="9" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="appleFloorGrid" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.88)" />
                <stop offset="100%" stopColor="rgba(245,245,247,0.72)" />
              </linearGradient>
            </defs>

            <rect
              x="18"
              y="22"
              width="684"
              height="376"
              rx="28"
              fill="url(#appleFloorGrid)"
              stroke="rgba(0,0,0,0.06)"
            />
            <path
              d="M66 210H654M360 54V366"
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="2"
              strokeDasharray="10 12"
            />

            {orderedBays.map((bay, index) => {
              const point = bayCoordinates(index);
              const style = stateStyles[bay.state];
              const isActive = activeBayId === bay.id;

              return (
                <motion.g
                  key={bay.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Bay ${bay.bahia} ${style.label}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: bay.state === "idle" ? 0.64 : 1, scale: 1 }}
                  transition={spring}
                  onMouseEnter={() => setActiveBayId(bay.id)}
                  onMouseLeave={() => setActiveBayId(null)}
                  onFocus={() => setActiveBayId(bay.id)}
                  onBlur={() => setActiveBayId(null)}
                  className={bay.state === "idle" ? "grayscale" : ""}
                >
                  <motion.circle
                    cx={point.x + 78}
                    cy={point.y + 48}
                    r={bay.state === "bottleneck" ? 62 : 52}
                    fill={style.aura}
                    filter="url(#appleSoftGlow)"
                    animate={{
                      opacity:
                        bay.state === "bottleneck"
                          ? [0.28, 0.55, 0.28]
                          : bay.state === "running"
                            ? [0.18, 0.34, 0.18]
                            : 0.12,
                      scale:
                        bay.state === "bottleneck" ? [0.96, 1.04, 0.96] : 1,
                    }}
                    transition={{
                      duration: bay.state === "bottleneck" ? 2.6 : 4.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.rect
                    x={point.x}
                    y={point.y}
                    width="156"
                    height="96"
                    rx="20"
                    fill={style.fill}
                    stroke={isActive ? "#1d1d1f" : style.stroke}
                    strokeWidth={isActive ? 2 : 1.4}
                    whileHover={{ y: -3 }}
                    transition={spring}
                  />
                  <text
                    x={point.x + 20}
                    y={point.y + 34}
                    fill="#1d1d1f"
                    fontSize="18"
                    fontWeight="700"
                  >
                    BAY {bay.bahia}
                  </text>
                  <text
                    x={point.x + 20}
                    y={point.y + 58}
                    fill="#86868b"
                    fontSize="11"
                  >
                    {bay.partNumber}
                  </text>
                  <text
                    x={point.x + 20}
                    y={point.y + 78}
                    fill={style.stroke}
                    fontSize="11"
                    fontWeight="700"
                  >
                    {style.label.toUpperCase()}
                  </text>
                </motion.g>
              );
            })}
          </svg>

          <motion.div
            initial={false}
            animate={{ opacity: activeBay ? 1 : 0, y: activeBay ? 0 : 8 }}
            transition={spring}
            className="pointer-events-none absolute right-4 top-4 w-64 rounded-3xl border border-black/[0.08] bg-white/90 p-4 shadow-2xl shadow-black/[0.08] backdrop-blur-2xl"
          >
            {activeBay ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#86868b]">
                    Bay {activeBay.bahia}
                  </span>
                  <span className="rounded-full bg-[#f5f5f7]/80 px-2 py-1 text-[0.65rem] text-[#86868b]">
                    {stateStyles[activeBay.state].label}
                  </span>
                </div>
                <p className="text-base font-semibold text-[#1d1d1f]">
                  {activeBay.currentWo}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[#f5f5f7]/80 p-3">
                    <Gauge className="mb-2 h-4 w-4 text-[#0071e3]" strokeWidth={1.5} />
                    <p className="text-xs text-[#86868b]">Progress</p>
                    <p className="font-semibold text-[#1d1d1f]">
                      {formatPercent(activeBay.completionPercent)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#f5f5f7]/80 p-3">
                    <Activity className="mb-2 h-4 w-4 text-[#34c759]" strokeWidth={1.5} />
                    <p className="text-xs text-[#86868b]">Throughput</p>
                    <p className="font-semibold text-[#1d1d1f]">
                      {typeof activeBay.throughput === "number"
                        ? `${activeBay.throughput}/h`
                        : "Sin datos"}
                    </p>
                  </div>
                </div>
                {typeof activeBay.sigmaLevel === "number" ? (
                  <div className="rounded-2xl bg-[#f5f5f7]/80 p-3">
                    <p className="text-xs text-[#86868b]">Sigma Level</p>
                    <p className="font-semibold text-[#1d1d1f]">
                      {activeBay.sigmaLevel.toFixed(2)}
                    </p>
                  </div>
                ) : null}
                {activeBay.state === "bottleneck" ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#ff9500]/20 bg-[#ff9500]/10 p-3 text-xs text-[#b45f00]">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                    Constraint detected
                  </div>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}
