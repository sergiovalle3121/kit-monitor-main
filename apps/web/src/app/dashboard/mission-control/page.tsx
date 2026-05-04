"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  Activity, 
  Zap, 
  Cpu, 
  Boxes, 
  Settings, 
  Maximize,
  RadioTower,
  Thermometer,
  Wind
} from "lucide-react";
import Link from "next/link";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { time: '08:00', yield: 85, target: 90 },
  { time: '10:00', yield: 88, target: 90 },
  { time: '12:00', yield: 92, target: 90 },
  { time: '14:00', yield: 89, target: 90 },
  { time: '16:00', yield: 95, target: 90 },
  { time: '18:00', yield: 91, target: 90 },
];

export default function MissionControlPage() {
  const [isLive, setIsLive] = useState(true);

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 lg:p-12 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 relative z-10">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1 flex items-center gap-3">
              Mission Control
              <span className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full border ${isLive ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                {isLive ? 'LIVE' : 'OFFLINE'}
              </span>
            </h1>
            <p className="text-gray-400 font-light">Global Plant Operations Digital Twin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2">
            <Maximize className="w-4 h-4" />
            Full Screen
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Main Plant Map/Grid */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="bg-[#111] p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden flex-1 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold flex items-center gap-2"><RadioTower className="w-5 h-5 text-cyan-500" /> Facility Map</h2>
              <div className="flex gap-4 text-xs font-bold text-gray-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Optimal</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
              </div>
            </div>

            {/* Simulated 3D Top-Down View of lines */}
            <div className="grid grid-cols-2 gap-4 h-[300px]">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                <h3 className="font-bold">SMT Line A1</h3>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Speed: 12k CPH</span>
                  <span>OEE: 92%</span>
                </div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <h3 className="font-bold">SMT Line B2</h3>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Speed: 8k CPH</span>
                  <span>OEE: 75%</span>
                </div>
                <div className="absolute bottom-4 right-4 animate-ping w-2 h-2 rounded-full bg-amber-500" />
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                <h3 className="font-bold">Assembly Cell 1</h3>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Operators: 4</span>
                  <span>Yield: 99%</span>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                <h3 className="font-bold text-red-500">Test Station QA-4</h3>
                <div className="flex justify-between text-xs text-red-400">
                  <span>Status: DOWN</span>
                  <span>Time: 14m</span>
                </div>
                <div className="absolute bottom-4 right-4 animate-ping w-2 h-2 rounded-full bg-red-500" />
              </motion.div>
            </div>
          </div>

          <div className="bg-[#111] p-8 rounded-[2rem] border border-white/10 shadow-2xl h-[300px]">
            <h2 className="font-bold mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-500" /> Output vs Target</h2>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                  <Line type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
                  <Line type="monotone" dataKey="target" stroke="#666" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar Diagnostics */}
        <div className="flex flex-col gap-8">
          <div className="bg-[#111] p-8 rounded-[2rem] border border-white/10 shadow-2xl">
            <h2 className="font-bold mb-6 flex items-center gap-2"><Thermometer className="w-5 h-5 text-rose-500" /> Environment</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <span className="text-gray-400 text-sm">Temperature</span>
                <span className="font-bold">22.4°C</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <span className="text-gray-400 text-sm">Humidity</span>
                <span className="font-bold">45%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                <span className="text-gray-400 text-sm">Particle Count</span>
                <span className="font-bold text-green-500">ISO Class 7</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111] p-8 rounded-[2rem] border border-white/10 shadow-2xl flex-1">
            <h2 className="font-bold mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Active Alerts</h2>
            <div className="space-y-4">
              <div className="p-4 border border-red-500/20 bg-red-500/10 rounded-xl relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-1 h-full bg-red-500" />
                <h4 className="font-bold text-red-500 text-sm mb-1">Test Station QA-4 Offline</h4>
                <p className="text-xs text-red-400">Voltage anomaly detected. Technician dispatched.</p>
              </div>
              <div className="p-4 border border-amber-500/20 bg-amber-500/10 rounded-xl relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-1 h-full bg-amber-500" />
                <h4 className="font-bold text-amber-500 text-sm mb-1">Low Yield SMT B2</h4>
                <p className="text-xs text-amber-400">Component misalignment rate &gt; 2%. Calibrate pick-and-place.</p>
              </div>
              <div className="p-4 border border-white/10 bg-white/5 rounded-xl relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-1 h-full bg-blue-500" />
                <h4 className="font-bold text-white text-sm mb-1">Shift Change in 30m</h4>
                <p className="text-xs text-gray-400">Prepare for handover to Shift 2.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
