"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

export type SigmaPoint = {
  sample: string;
  mean: number;
  range: number;
};

type SigmaChartProps = {
  title: string;
  data: SigmaPoint[];
  mode: "xbar" | "range";
};

const spring = { type: "spring", damping: 20, stiffness: 100 } as const;

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function SigmaChart({ title, data, mode }: SigmaChartProps) {
  const stats = useMemo(() => {
    const values = data.map((point) => (mode === "xbar" ? point.mean : point.range));
    const center = average(values);
    const variance = average(values.map((value) => (value - center) ** 2));
    const sigma = Math.sqrt(variance);
    const ucl = center + sigma * 3;
    const lcl = Math.max(0, center - sigma * 3);

    return {
      center,
      ucl,
      lcl,
      rows: data.map((point) => {
        const value = mode === "xbar" ? point.mean : point.range;
        return {
          ...point,
          value,
          alert: value > ucl || value < lcl,
        };
      }),
    };
  }, [data, mode]);

  const alertCount = stats.rows.filter((point) => point.alert).length;

  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { ...spring, staggerChildren: 0.05 },
        },
      }}
      className="premium-glass rounded-[var(--border-radius-custom)] p-5 text-white shadow-2xl shadow-black/30"
    >
      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="mb-4 flex items-start justify-between gap-4"
      >
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/45">
            Sigma Control
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
          <AlertTriangle className="h-4 w-4 text-[#FF005C]" strokeWidth={1.5} />
          {alertCount} critical
        </div>
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="h-[280px] min-h-[280px] w-full"
      >
        <ResponsiveContainer
          width="100%"
          height={260}
          minWidth={260}
          minHeight={260}
          initialDimension={{ width: 720, height: 260 }}
        >
          <ComposedChart data={stats.rows} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="sample"
              stroke="rgba(255,255,255,0.42)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.42)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              domain={["dataMin - 2", "dataMax + 2"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(0,242,234,0.25)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(0,0,0,0.82)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "14px",
                color: "white",
                backdropFilter: "blur(18px)",
              }}
            />
            <ReferenceLine
              y={stats.center}
              label={{ value: "Mean", fill: "rgba(255,255,255,0.58)", fontSize: 11 }}
              stroke="rgba(0,242,234,0.72)"
              strokeDasharray="6 6"
            />
            <ReferenceLine
              y={stats.ucl}
              label={{ value: "UCL", fill: "#FFB800", fontSize: 11 }}
              stroke="#FFB800"
              strokeDasharray="4 8"
            />
            <ReferenceLine
              y={stats.lcl}
              label={{ value: "LCL", fill: "#FFB800", fontSize: 11 }}
              stroke="#FFB800"
              strokeDasharray="4 8"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--brand-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "#FFFFFF", strokeWidth: 2 }}
            />
            <Scatter dataKey="value">
              {stats.rows.map((point) => (
                <Cell
                  key={`${point.sample}-${point.value}`}
                  fill={point.alert ? "#FF005C" : "#00F2EA"}
                  stroke={point.alert ? "#FFFFFF" : "transparent"}
                  strokeWidth={point.alert ? 2 : 0}
                />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.section>
  );
}
