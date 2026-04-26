"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Settings2,
  ChevronLeft,
  Activity,
  Cpu
} from "lucide-react";
import Link from "next/link";
import type { OeeFactors, WorkOrder, WorkOrderStatus } from "./production.types";
import { calculateOee, getWorkOrderProgress, groupWorkOrdersByStatus } from "./production.utils";

const oeeFactors: OeeFactors = {
  availability: 92,
  performance: 88,
  quality: 99,
};

const workOrders: WorkOrder[] = [
  {
    id: "WO-8821",
    partNumber: "AX-Main-Chassis",
    description: "Main chassis assembly",
    quantity: 150,
    completedQuantity: 98,
    status: "In Progress",
    priority: "High",
    lineId: "Line A1",
    stationId: "ST-04",
    dueDate: "2026-04-28",
    operator: "S. Valle",
  },
  {
    id: "WO-8822",
    partNumber: "AX-Control-Module",
    description: "Controller module build",
    quantity: 50,
    completedQuantity: 6,
    status: "In Progress",
    priority: "Urgent",
    lineId: "Line A1",
    stationId: "ST-02",
    dueDate: "2026-04-26",
    operator: "M. Ruiz",
  },
  {
    id: "WO-8823",
    partNumber: "AX-Cable-Harness",
    description: "Harness prep and routing",
    quantity: 300,
    completedQuantity: 0,
    status: "Pending",
    priority: "Medium",
    lineId: "Line B2",
    dueDate: "2026-04-30",
  },
  {
    id: "WO-8824",
    partNumber: "AX-Sensor-Array",
    description: "Sensor array validation",
    quantity: 200,
    completedQuantity: 200,
    status: "Quality Check",
    priority: "High",
    lineId: "Line A1",
    stationId: "QA-01",
    dueDate: "2026-04-27",
    operator: "A. Chen",
  },
  {
    id: "WO-8825",
    partNumber: "AX-Housing-Seal",
    description: "Final housing seal",
    quantity: 120,
    completedQuantity: 120,
    status: "Completed",
    priority: "Low",
    lineId: "Line C3",
    stationId: "FG-02",
    dueDate: "2026-04-25",
  },
];

const statusStyles: Record<WorkOrderStatus, string> = {
  Pending: "bg-slate-50 text-slate-500 border-slate-100 dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
  "In Progress": "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  "Quality Check": "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  Completed: "bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20",
};

const statusIcons: Record<WorkOrderStatus, React.ElementType> = {
  Pending: Clock,
  "In Progress": Play,
  "Quality Check": Activity,
  Completed: CheckCircle2,
};

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
  const oeeScore = calculateOee(oeeFactors);
  const kanbanColumns = useMemo(() => groupWorkOrdersByStatus(workOrders), []);

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
            <OEEGauge value={oeeFactors.availability} label="Availability" />
            <OEEGauge value={oeeFactors.performance} label="Performance" />
            <OEEGauge value={oeeFactors.quality} label="Quality" />
          </div>

          <div className="w-full pt-10 border-t border-gray-100 dark:border-white/5 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Target</p>
              <p className="text-xl font-bold">85%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Current</p>
              <p className="text-xl font-bold text-green-500">{oeeScore}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Trend</p>
              <p className="text-xl font-bold text-blue-500">+4.5%</p>
            </div>
          </div>
        </div>

        {/* Right: Work Orders Kanban */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex justify-between items-end mb-2 px-2">
            <h3 className="text-2xl font-bold tracking-tight">Work Orders Kanban</h3>
            <Link href="#" className="text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors">View All Schedule</Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {kanbanColumns.map((column) => {
              const StatusIcon = statusIcons[column.id];

              return (
                <section
                  key={column.id}
                  data-kanban-status={column.id}
                  className="min-h-[420px] rounded-[2rem] border border-gray-100 bg-white/70 p-4 dark:border-white/5 dark:bg-[#111]/70"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-xl border p-2 ${statusStyles[column.id]}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-tight">{column.title}</h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {column.workOrders.length} orders
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {column.workOrders.map((wo, index) => {
                      const progress = getWorkOrderProgress(wo);

                      return (
                        <motion.article
                          key={wo.id}
                          draggable
                          data-work-order-id={wo.id}
                          data-drag-from-status={wo.status}
                          data-drag-from-index={index}
                          whileHover={{ y: -3 }}
                          className="group rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-black/5 dark:border-white/5 dark:bg-[#161616] dark:hover:shadow-white/5"
                        >
                          <div className="mb-5 flex items-start justify-between gap-3">
                            <div>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ${
                                wo.priority === "Urgent" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/5"
                              }`}>
                                {wo.priority}
                              </span>
                              <h5 className="mt-2 text-base font-bold">{wo.id}</h5>
                              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-tight text-gray-400">
                                {wo.partNumber}
                              </p>
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{wo.description}</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3 text-gray-400 dark:bg-white/5">
                              <Cpu className="h-4 w-4" />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                              <span className="text-gray-400">Progress</span>
                              <span>
                                {progress}% <span className="font-light text-gray-300">/ 100%</span>
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-50 dark:bg-white/5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-black dark:bg-white"
                              />
                            </div>
                          </div>

                          <div className="mt-6 flex items-center justify-between border-t border-gray-50 pt-4 dark:border-white/5">
                            <div>
                              <p className="text-xs font-bold">{wo.quantity} units</p>
                              <p className="text-[10px] font-medium text-gray-400">{wo.lineId}</p>
                            </div>
                            <button className="rounded-xl bg-gray-50 p-3 text-gray-400 transition-all hover:bg-gray-100 hover:text-black dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white">
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
