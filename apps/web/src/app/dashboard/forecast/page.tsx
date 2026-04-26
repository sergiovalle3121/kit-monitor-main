"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  LineChart, 
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
  AlertTriangle
} from "lucide-react";
import Link from "next/link";

// Mock Data for Monte Carlo Simulation
const generateSimulationData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    name: `Day ${i + 1}`,
    actual: i < 10 ? 400 + Math.random() * 100 : null,
    projection: 400 + i * 10 + Math.random() * 50,
    upperBound: 450 + i * 12 + Math.random() * 80,
    lowerBound: 350 + i * 8 - Math.random() * 80,
  }));
};

const data = generateSimulationData();

const ControlLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">
    {children}
  </label>
);

export default function ForecastLabPage() {
  const [isSimulating, setIsSimulating] = useState(false);

  const startSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => setIsSimulating(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-black dark:bg-white text-[10px] font-bold text-white dark:text-black uppercase tracking-tighter">Lab</span>
              <h1 className="text-4xl font-bold tracking-tight">Mathematical Prediction Laboratory</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-light">Monte Carlo Simulation & Sigma Stability Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Dataset
          </button>
          <button 
            onClick={startSimulation}
            disabled={isSimulating}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {isSimulating ? "Computing..." : "Run Simulation"}
          </button>
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
                  <p className="text-2xl font-bold">94.2%</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Sigma (σ)</h3>
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
                <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProjection" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="upperBound" 
                    stroke="transparent" 
                    fill="#9CA3AF" 
                    fillOpacity={0.1} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lowerBound" 
                    stroke="transparent" 
                    fill="#9CA3AF" 
                    fillOpacity={0.1} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projection" 
                    stroke="#000000" 
                    strokeWidth={3} 
                    dot={false} 
                    strokeDasharray="5 5"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#000000" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#000000', strokeWidth: 0 }} 
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
              <p className="text-2xl font-bold">10,000</p>
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
                  <span className="text-xs font-bold">10k</span>
                </div>
                <input type="range" className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <ControlLabel>Confidence Interval</ControlLabel>
                  <span className="text-xs font-bold">95%</span>
                </div>
                <input type="range" className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <ControlLabel>Volatility Factor</ControlLabel>
                  <span className="text-xs font-bold">0.15</span>
                </div>
                <input type="range" className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" />
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
              Your current process stability is at 2.4σ. To reach Six Sigma (6σ), you need to reduce variance in the "Project-X1" assembly line by 42%.
            </p>
            <button className="text-xs font-bold flex items-center gap-2 group underline underline-offset-4">
              View Stability Report
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
