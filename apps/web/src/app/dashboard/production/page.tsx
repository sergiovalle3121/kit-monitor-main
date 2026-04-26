"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Settings2,
  Layers,
  ChevronLeft,
  Activity,
  Cpu
} from "lucide-react";
import Link from "next/link";

// Mock Work Orders
const workOrders = [
  { id: "WO-8821", part: "AX-Main-Chassis", qty: 150, progress: 65, status: "In Progress", priority: "High" },
  { id: "WO-8822", part: "AX-Control-Module", qty: 50, progress: 12, status: "In Progress", priority: "Urgent" },
  { id: "WO-8823", part: "AX-Cable-Harness", qty: 300, progress: 0, status: "Pending", priority: "Medium" },
  { id: "WO-8824", part: "AX-Sensor-Array", qty: 200, progress: 100, status: "Quality Check", priority: "High" },
];

const OEEGauge = ({ value, label }: { value: number, label: string }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-gray-100 dark:text-white/5"
          />
          <motion.circle
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            className="text-black dark:text-white"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{value}%</span>
        </div>
      </div>
      <span className="mt-4 text-xs font-bold uppercase tracking-widest text-gray-400">{label}</span>
    </div>
  );
};

export default function ProductionPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Production Control</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Real-time shop floor execution and OEE monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Report Line Stop
          </button>
          <button className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Line Settings
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left: Line Efficiency (OEE) */}
        <div className="bg-white dark:bg-[#111] p-10 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col items-center justify-center">
          <div className="mb-10 text-center">
            <h3 className="text-xl font-bold tracking-tight">Line Efficiency (OEE)</h3>
            <p className="text-sm text-gray-400 font-light mt-1">Real-time calculation for Line A1</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-12 mb-10">
            <OEEGauge value={92} label="Availability" />
            <OEEGauge value={88} label="Performance" />
            <OEEGauge value={99} label="Quality" />
          </div>

          <div className="w-full pt-10 border-t border-gray-100 dark:border-white/5 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Target</p>
              <p className="text-xl font-bold">85%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Current</p>
              <p className="text-xl font-bold text-green-500">80.2%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Trend</p>
              <p className="text-xl font-bold text-blue-500">+4.5%</p>
            </div>
          </div>
        </div>

        {/* Right: Active Work Orders */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex justify-between items-end mb-2 px-2">
            <h3 className="text-2xl font-bold tracking-tight">Active Work Orders</h3>
            <Link href="#" className="text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">View All Schedule</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workOrders.map((wo) => (
              <motion.div 
                key={wo.id}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${
                      wo.priority === 'Urgent' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500'
                    }`}>
                      {wo.priority}
                    </span>
                    <h4 className="text-lg font-bold mt-2">{wo.id}</h4>
                    <p className="text-xs text-gray-400 font-medium tracking-tight uppercase mt-0.5">{wo.part}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${
                    wo.status === 'In Progress' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-50 dark:bg-white/5 text-gray-400'
                  }`}>
                    {wo.status === 'In Progress' ? <Activity className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span className="text-gray-400">Progress</span>
                    <span>{wo.progress}% <span className="text-gray-300 font-light">/ 100%</span></span>
                  </div>
                  <div className="h-2 w-full bg-gray-50 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${wo.progress}%` }}
                      className="h-full bg-black dark:bg-white"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-gray-400" />
                    </div>
                    <span className="text-xs font-bold">{wo.qty} units</span>
                  </div>
                  <button className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
