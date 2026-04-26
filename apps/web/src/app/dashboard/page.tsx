"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  Box, 
  Calendar, 
  ChevronRight, 
  LayoutDashboard, 
  Settings, 
  Users, 
  Package, 
  AlertCircle, 
  CheckCircle2, 
  Bell, 
  Search,
  Layers,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";

const SidebarItem = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
    active 
      ? "bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/5" 
      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
  }`}>
    <Icon className="w-5 h-5" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

const StatCard = ({ title, value, change, icon: Icon, trend }: { title: string, value: string, change: string, icon: any, trend: "up" | "down" }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-black dark:text-white" />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
        {change}
        <ArrowUpRight className={`w-3 h-3 ${trend === "down" && "rotate-90"}`} />
      </div>
    </div>
    <h3 className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
    <div className="text-3xl font-bold tracking-tight">{value}</div>
  </motion.div>
);

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] flex">
      
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-[#111] border-r border-gray-100 dark:border-white/5 p-6 hidden lg:flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-white dark:text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight">AXOS <span className="font-light opacity-40">OS</span></span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Control Tower" active />
            <SidebarItem icon={Package} label="Inventory" />
            <SidebarItem icon={Activity} label="Production" />
            <SidebarItem icon={TrendingUp} label="Forecast" />
            <SidebarItem icon={CheckCircle2} label="Quality" />
            <SidebarItem icon={Users} label="Team" />
          </nav>
        </div>

        <div className="space-y-1">
          <SidebarItem icon={Settings} label="Settings" />
          <div className="pt-6 mt-6 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/20 border border-white/20" />
              <div className="flex-1">
                <p className="text-sm font-bold truncate">Sergio Valle</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">AXOS Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Control Tower</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Real-time operational overview for <span className="font-medium text-black dark:text-white">Plant A1-TX</span></p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                className="w-full bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>
            <button className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl relative hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#111]" />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Inventory" value="12,840" change="+12.5%" icon={Package} trend="up" />
          <StatCard title="Production Yield" value="98.2%" change="+2.1%" icon={Activity} trend="up" />
          <StatCard title="Active Orders" value="142" change="-3.4%" icon={Box} trend="down" />
          <StatCard title="Critical Alerts" value="03" change="Stable" icon={AlertCircle} trend="up" />
        </div>

        {/* Main Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Live Production Chart Placeholder */}
          <div className="xl:col-span-2 bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Production Output</h3>
                <p className="text-sm text-gray-400 font-light">Last 24 hours performance</p>
              </div>
              <select className="bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-xs font-bold outline-none">
                <option>Weekly View</option>
                <option>Daily View</option>
              </select>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-black/20 rounded-3xl flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-white/5">
              <p className="text-gray-400 text-sm font-light italic">Interactive Charts (Recharts) Coming Soon...</p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight mb-6">Recent Activity</h3>
            <div className="space-y-6">
              {[
                { time: "2m ago", user: "John Doe", action: "Approved BOM", target: "Project-X1" },
                { time: "15m ago", user: "AI Engine", action: "Predicted Shortage", target: "Component-77" },
                { time: "1h ago", user: "Warehouse", action: "Received Kitting", target: "Lot #2284" },
                { time: "3h ago", user: "System", action: "Generated Forecast", target: "Q3 2026" }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold shrink-0">
                    {item.user.split(' ')[0][0]}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-bold">{item.user}</span> {item.action} 
                      <span className="text-gray-400 ml-1">for {item.target}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mt-1 tracking-tight">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 bg-gray-50 dark:bg-white/5 rounded-2xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
              View All History
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}
