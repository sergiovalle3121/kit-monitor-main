"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  ChevronLeft, 
  Play, 
  RotateCcw, 
  Settings2, 
  BarChart3, 
  Binary, 
  Sigma, 
  History,
  Download,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

const simulationPalette = {
  actual: "#0F766E",
  actualDot: "#14B8A6",
  projection: "#7C3AED",
  projectionGlow: "#A78BFA",
  upperBound: "#38BDF8",
  lowerBound: "#F59E0B",
  grid: "#CBD5E1",
  tick: "#94A3B8",
};

const buttonMotion = {
  whileHover: { y: -2, scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 420, damping: 28 },
} as const;

interface SimulationPoint {
  name: string;
  projection: number;
  upperBound: number;
  lowerBound: number;
  actual: number | null;
}

interface SimulationProjection {
  period: number;
  p10: number;
  p50: number;
  p90: number;
}

interface SimulationResponse {
  projections: SimulationProjection[];
}

const createInitialSimulationData = (): SimulationPoint[] =>
  Array.from({ length: 20 }, (_, index) => {
    const period = index + 1;
    const projection = 420 + period * 8;

    return {
      name: `P${period}`,
      projection,
      upperBound: projection + 38,
      lowerBound: projection - 34,
      actual: null,
    };
  });

const ControlLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">
    {children}
  </label>
);

export default function ForecastLabPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [cycles, setCycles] = useState(10000);
  const [confidence, setConfidence] = useState(95);
  const [volatility, setVolatility] = useState(0.15);
  const [simulationData, setSimulationData] = useState<SimulationPoint[]>(createInitialSimulationData);

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      // Calling Claude's new endpoint
      const response = await fetch("/api/forecast/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historicalData: [420, 435, 410, 445, 430, 455, 440, 465, 450, 475, 460, 485],
          config: {
            periods: 20,
            iterations: cycles,
            confidenceInterval: confidence / 100,
            volatility: volatility
          }
        })
      });

      if (response.ok) {
        const result = (await response.json()) as SimulationResponse;
        const formattedData = result.projections.map((p, i): SimulationPoint => ({
          name: `P${p.period}`,
          projection: p.p50,
          upperBound: p.p90,
          lowerBound: p.p10,
          actual: i < 0 ? 460 : null // Placeholder for historical alignment
        }));
        setSimulationData(formattedData);
      }
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <motion.div {...buttonMotion}>
            <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10 dark:hover:border-teal-400/20 dark:hover:shadow-teal-400/5 transition-all duration-300 inline-flex">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </motion.div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-black dark:bg-white text-[10px] font-bold text-white dark:text-black uppercase tracking-tighter">Lab</span>
              <h1 className="text-4xl font-bold tracking-tight">Mathematical Prediction Laboratory</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-light">Monte Carlo Simulation & Sigma Stability Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            {...buttonMotion}
            className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 dark:hover:bg-white/5 dark:hover:border-white/20 dark:hover:shadow-white/5 transition-colors duration-300 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Dataset
          </motion.button>
          <motion.button 
            type="button"
            onClick={runSimulation}
            disabled={isSimulating}
            whileHover={isSimulating ? undefined : buttonMotion.whileHover}
            whileTap={isSimulating ? undefined : buttonMotion.whileTap}
            transition={buttonMotion.transition}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:shadow-2xl hover:shadow-violet-500/20 dark:hover:shadow-teal-300/10 transition-shadow duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {isSimulating ? "Computing..." : "Run Simulation"}
          </motion.button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left: Simulation Canvas */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* Main Chart Card */}
          <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex gap-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Confidence Level</h3>
                  <p className="text-2xl font-bold">{confidence}%</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Sigma (&sigma;)</h3>
                  <p className="text-2xl font-bold">2.4</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <History className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold">Historical Window: 90 Days</span>
              </div>
            </div>

            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProjection" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={simulationPalette.projectionGlow} stopOpacity={0.16}/>
                      <stop offset="95%" stopColor={simulationPalette.projectionGlow} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={simulationPalette.upperBound} stopOpacity={0.16}/>
                      <stop offset="55%" stopColor={simulationPalette.projectionGlow} stopOpacity={0.08}/>
                      <stop offset="95%" stopColor={simulationPalette.lowerBound} stopOpacity={0.14}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" vertical={false} stroke={simulationPalette.grid} opacity={0.35} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: simulationPalette.tick }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: simulationPalette.tick }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '18px', 
                      border: '1px solid rgb(226 232 240 / 0.85)', 
                      boxShadow: '0 20px 45px -18px rgb(15 23 42 / 0.35)',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: 'rgb(255 255 255 / 0.96)'
                    }}
                    labelStyle={{
                      color: '#334155',
                      marginBottom: '6px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="upperBound" 
                    stroke={simulationPalette.upperBound}
                    strokeOpacity={0.3}
                    strokeWidth={1.5}
                    fill="url(#confidenceBand)" 
                    fillOpacity={1} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lowerBound" 
                    stroke={simulationPalette.lowerBound}
                    strokeOpacity={0.25}
                    strokeWidth={1.5}
                    fill="url(#colorProjection)" 
                    fillOpacity={1} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projection" 
                    stroke={simulationPalette.projection} 
                    strokeWidth={3} 
                    dot={false} 
                    strokeDasharray="7 7"
                    activeDot={{ r: 6, fill: simulationPalette.projection, stroke: '#FFFFFF', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Bottleneck Risk</h4>
              </div>
              <p className="text-2xl font-bold">Medium</p>
              <div className="mt-4 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 w-[65%]" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-500/10 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-green-500" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Forecast Accuracy</h4>
              </div>
              <p className="text-2xl font-bold">92.8%</p>
              <p className="text-[10px] text-green-500 font-bold mt-1">+1.2% from last run</p>
            </div>

            <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                  <Binary className="w-4 h-4 text-blue-500" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">Monte Carlo Iterations</h4>
              </div>
              <p className="text-2xl font-bold">{cycles.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 font-bold mt-1">High Precision Mode</p>
            </div>
          </div>
        </div>

        {/* Right: Controls Panel */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <Settings2 className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-bold tracking-tight">Parameters</h3>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <ControlLabel>Simulation Cycles</ControlLabel>
                  <span className="text-xs font-bold">{cycles / 1000}k</span>
                </div>
                <input 
                  type="range" 
                  min="1000"
                  max="50000"
                  step="1000"
                  value={cycles}
                  onChange={(e) => setCycles(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <ControlLabel>Confidence Interval</ControlLabel>
                  <span className="text-xs font-bold">{confidence}%</span>
                </div>
                <input 
                  type="range" 
                  min="50"
                  max="99"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <ControlLabel>Volatility Factor</ControlLabel>
                  <span className="text-xs font-bold">{volatility}</span>
                </div>
                <input 
                  type="range" 
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={volatility}
                  onChange={(e) => setVolatility(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" 
                />
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Auto-Optimize</span>
                  <div className="w-10 h-5 bg-black dark:bg-white rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white dark:bg-black rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Anomaly Detection</span>
                  <div className="w-10 h-5 bg-gray-200 dark:bg-white/10 rounded-full relative">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white dark:bg-black rounded-full shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sigma Info Card */}
          <div className="bg-black dark:bg-white p-8 rounded-[2.5rem] text-white dark:text-black">
            <div className="flex items-center gap-3 mb-4 opacity-60">
              <Sigma className="w-5 h-5" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Sigma Analysis</h3>
            </div>
            <p className="text-sm font-light leading-relaxed mb-6 opacity-80">
              Your current process stability is at 2.4&sigma;. To reach Six Sigma (6&sigma;), you need to reduce variance in Project-X1 assembly line by 42%.
            </p>
            <motion.button
              type="button"
              {...buttonMotion}
              className="text-xs font-bold flex items-center gap-2 group underline underline-offset-4"
            >
              View Stability Report
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
}
