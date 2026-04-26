"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Gauge, RadioTower } from "lucide-react";

export type PlantFloorBayState = "running" | "bottleneck" | "idle";

export type PlantFloorBay = {
  id: number;
  model: string;
  partNumber: string;
  bahia: number;
  minStock?: number | null;
  state: PlantFloorBayState;
  currentWo: string;
  sigmaLevel: number;
  throughput: number;
};

type PlantFloorProps = {
  bays: PlantFloorBay[];
};

const spring = { type: "spring", damping: 20, stiffness: 100 } as const;

const stateStyles: Record<
  PlantFloorBayState,
  { fill: string; stroke: string; aura: string; label: string }
> = {
  running: {
    fill: "rgba(0, 242, 234, 0.18)",
    stroke: "#00F2EA",
    aura: "rgba(0, 242, 234, 0.42)",
    label: "Running",
  },
  bottleneck: {
    fill: "rgba(255, 184, 0, 0.2)",
    stroke: "#FFB800",
    aura: "rgba(255, 0, 92, 0.45)",
    label: "Bottleneck",
  },
  idle: {
    fill: "rgba(148, 163, 184, 0.08)",
    stroke: "rgba(148, 163, 184, 0.55)",
    aura: "rgba(148, 163, 184, 0.18)",
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

export function PlantFloor({ bays }: PlantFloorProps) {
  const [activeBayId, setActiveBayId] = useState<number | null>(null);
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
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { ...spring, staggerChildren: 0.06 },
        },
      }}
      className="premium-glass relative overflow-hidden rounded-[var(--border-radius-custom)] p-5 text-white shadow-2xl shadow-black/30"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45">
            Industrial Digital Twin
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Plant Floor V1.0
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
          <RadioTower className="h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
          Live telemetry
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 720 430"
          role="img"
          aria-label="Plant floor digital twin"
          className="h-auto w-full"
        >
          <defs>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="floorGrid" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(0,242,234,0.08)" />
            </linearGradient>
          </defs>

          <rect
            x="18"
            y="22"
            width="684"
            height="376"
            rx="28"
            fill="url(#floorGrid)"
            stroke="rgba(255,255,255,0.1)"
          />
          <path
            d="M66 210H654M360 54V366"
            stroke="rgba(255,255,255,0.08)"
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
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: bay.state === "idle" ? 0.55 : 1, scale: 1 }}
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
                  r={bay.state === "bottleneck" ? 66 : 54}
                  fill={style.aura}
                  filter="url(#softGlow)"
                  animate={{
                    opacity:
                      bay.state === "bottleneck"
                        ? [0.35, 0.82, 0.35]
                        : bay.state === "running"
                          ? [0.22, 0.46, 0.22]
                          : 0.16,
                    scale:
                      bay.state === "bottleneck" ? [0.94, 1.08, 0.94] : 1,
                  }}
                  transition={{
                    duration: bay.state === "bottleneck" ? 1.8 : 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.rect
                  x={point.x}
                  y={point.y}
                  width="156"
                  height="96"
                  rx="18"
                  fill={style.fill}
                  stroke={isActive ? "#FFFFFF" : style.stroke}
                  strokeWidth={isActive ? 2 : 1.4}
                  whileHover={{ y: -4 }}
                  transition={spring}
                />
                <text
                  x={point.x + 20}
                  y={point.y + 34}
                  fill="rgba(255,255,255,0.92)"
                  fontSize="18"
                  fontWeight="700"
                >
                  BAY {bay.bahia}
                </text>
                <text
                  x={point.x + 20}
                  y={point.y + 58}
                  fill="rgba(255,255,255,0.56)"
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
          animate={{ opacity: activeBay ? 1 : 0, y: activeBay ? 0 : 10 }}
          transition={spring}
          className="pointer-events-none absolute right-4 top-4 w-64 rounded-2xl border border-white/10 bg-black/75 p-4 shadow-2xl backdrop-blur-2xl"
        >
          {activeBay ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Bay {activeBay.bahia}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[0.65rem] text-white/70">
                  {stateStyles[activeBay.state].label}
                </span>
              </div>
              <p className="text-base font-semibold">{activeBay.currentWo}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <Gauge className="mb-2 h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
                  <p className="text-xs text-white/50">Sigma</p>
                  <p className="font-semibold">{activeBay.sigmaLevel.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <Activity className="mb-2 h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.5} />
                  <p className="text-xs text-white/50">Throughput</p>
                  <p className="font-semibold">{activeBay.throughput}/h</p>
                </div>
              </div>
              {activeBay.state === "bottleneck" ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#FFB800]/25 bg-[#FFB800]/10 p-3 text-xs text-[#FFB800]">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                  Constraint detected
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </div>
    </motion.section>
  );
}
