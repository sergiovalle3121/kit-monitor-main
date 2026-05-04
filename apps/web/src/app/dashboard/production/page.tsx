"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Play, 
  Pause, 
  CheckCircle,
  Activity,
  Cpu,
  Clock,
  AlertTriangle,
  Settings,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";

type OrderStatus = "Scheduled" | "In Progress" | "Paused" | "Completed";

interface WorkOrder {
  id: string;
  product: string;
  sku: string;
  quantity: number;
  completed: number;
  status: OrderStatus;
  line: string;
  efficiency: number;
}

const initialOrders: WorkOrder[] = [
  { id: "WO-10024", product: "Controller V3", sku: "PRD-9921", quantity: 500, completed: 342, status: "In Progress", line: "Line A1", efficiency: 94 },
  { id: "WO-10025", product: "Thermal Sensor Grid", sku: "PRD-8840", quantity: 1200, completed: 0, status: "Scheduled", line: "Line B2", efficiency: 0 },
  { id: "WO-10023", product: "Robotic Arm Actuator", sku: "PRD-7732", quantity: 150, completed: 150, status: "Completed", line: "Line A1", efficiency: 88 },
  { id: "WO-10026", product: "Power Supply Unit", sku: "PRD-5511", quantity: 800, completed: 410, status: "Paused", line: "Line C1", efficiency: 72 },
];

export default function ProductionMESPage() {
  const [orders, setOrders] = useState<WorkOrder[]>(initialOrders);
  const [activeTab, setActiveTab] = useState("all");
  
  const handleStatusChange = (id: string, newStatus: OrderStatus) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === "active") return o.status === "In Progress" || o.status === "Paused";
    if (activeTab === "scheduled") return o.status === "Scheduled";
    if (activeTab === "completed") return o.status === "Completed";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Production Execution</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Manufacturing Execution System (MES)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-[#111] p-1.5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
          {["all", "active", "scheduled", "completed"].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                activeTab === tab 
                  ? "bg-black text-white dark:bg-white dark:text-black shadow-md" 
                  : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl"><Activity className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Global OEE</span>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tighter">88.4<span className="text-xl text-gray-400">%</span></p>
            <p className="text-xs text-green-500 font-bold mt-1">+2.1% from last shift</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl"><CheckCircle className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Yield Rate</span>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tighter">99.1<span className="text-xl text-gray-400">%</span></p>
            <p className="text-xs text-green-500 font-bold mt-1">On Target</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-xl"><AlertTriangle className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Downtime</span>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tighter">14<span className="text-xl text-gray-400">m</span></p>
            <p className="text-xs text-amber-500 font-bold mt-1">Line C1 Issue</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl"><Cpu className="w-5 h-5" /></div>
            <span className="font-bold text-sm">Units Produced</span>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tighter">4,821</p>
            <p className="text-xs text-gray-400 font-medium mt-1">Current Shift</p>
          </div>
        </div>
      </div>

      {/* Active Work Orders */}
      <h2 className="text-2xl font-bold mb-6">Work Orders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredOrders.map(order => {
            const progress = (order.completed / order.quantity) * 100;
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={order.id}
                className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-xl transition-all"
              >
                {/* Background Progress Indicator */}
                <div 
                  className={`absolute bottom-0 left-0 h-1.5 transition-all duration-1000 ${
                    order.status === 'Completed' ? 'bg-emerald-500' :
                    order.status === 'In Progress' ? 'bg-blue-500' :
                    order.status === 'Paused' ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-800'
                  }`} 
                  style={{ width: `${progress}%` }} 
                />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">{order.line}</span>
                    <h3 className="text-2xl font-bold tracking-tight">{order.id}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    order.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20' :
                    order.status === 'Paused' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20' :
                    order.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                    'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400'
                  }`}>
                    {order.status}
                  </span>
                </div>

                <div className="mb-6">
                  <p className="font-medium">{order.product}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">SKU: {order.sku}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Progress</p>
                    <p className="text-lg font-bold">{order.completed} <span className="text-xs text-gray-400 font-normal">/ {order.quantity}</span></p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Efficiency</p>
                    <p className="text-lg font-bold">{order.efficiency}%</p>
                  </div>
                </div>

                <div className="mt-auto flex gap-3">
                  {order.status === "Scheduled" || order.status === "Paused" ? (
                    <button 
                      onClick={() => handleStatusChange(order.id, "In Progress")}
                      className="flex-1 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4" /> Start
                    </button>
                  ) : order.status === "In Progress" ? (
                    <button 
                      onClick={() => handleStatusChange(order.id, "Paused")}
                      className="flex-1 py-3 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                  ) : null}
                  
                  {order.status !== "Completed" && (
                    <button 
                      onClick={() => handleStatusChange(order.id, "Completed")}
                      className="p-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-emerald-100 hover:text-emerald-600 transition-all"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  
                  <button className="p-3 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl transition-all">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
