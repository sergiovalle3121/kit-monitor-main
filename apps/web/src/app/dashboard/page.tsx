"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  BarChart3, 
  Activity, 
  ShieldCheck, 
  LayoutGrid, 
  Bell, 
  Settings, 
  User,
  Search,
  Zap,
  Cpu,
  Boxes,
  DollarSign,
  TrendingUp,
  Lock,
  RadioTower
} from "lucide-react";
import Link from "next/link";

const apps = [
  {
    id: "mission-control",
    name: "Mission Control",
    icon: <RadioTower className="w-8 h-8 text-cyan-500" strokeWidth={1.5} />,
    color: "bg-cyan-50 dark:bg-cyan-500/10",
    href: "/dashboard/mission-control",
    description: "War Room"
  },
  { 
    id: "inventory", 
    name: "Inventory", 
    icon: <Boxes className="w-8 h-8 text-blue-500" />, 
    color: "bg-blue-50 dark:bg-blue-500/10", 
    href: "/dashboard/inventory",
    description: "Stock & Materials"
  },
  { 
    id: "forecast", 
    name: "Forecast", 
    icon: <BarChart3 className="w-8 h-8 text-violet-500" />, 
    color: "bg-violet-50 dark:bg-violet-500/10", 
    href: "/dashboard/forecast",
    description: "Predictions"
  },
  { 
    id: "production", 
    name: "Production", 
    icon: <Cpu className="w-8 h-8 text-amber-500" />, 
    color: "bg-amber-50 dark:bg-amber-500/10", 
    href: "/dashboard/production",
    description: "Shop Floor"
  },
  { 
    id: "quality", 
    name: "Quality", 
    icon: <ShieldCheck className="w-8 h-8 text-green-500" />, 
    color: "bg-green-50 dark:bg-green-500/10", 
    href: "/dashboard/quality",
    description: "NCR & Audits"
  },
  { 
    id: "finance", 
    name: "Finance", 
    icon: <DollarSign className="w-8 h-8 text-emerald-500" />, 
    color: "bg-emerald-50 dark:bg-emerald-500/10", 
    href: "/dashboard/finance",
    description: "Financial Ledger"
  },
  { 
    id: "settings-users", 
    name: "Identity", 
    icon: <Lock className="w-8 h-8 text-rose-500" />, 
    color: "bg-rose-50 dark:bg-rose-500/10", 
    href: "/dashboard/settings/users",
    description: "Roles & Permissions"
  }
];

export default function DashboardLauncher() {
  const router = useRouter();
  const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    // Borrar la cookie de sesión
    document.cookie = "axos_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black text-black dark:text-white font-sans overflow-hidden">
      
      {/* Top Bar (iOS Style) */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-gray-200/50 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight">Axos OS</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-200/50 dark:bg-white/10 rounded-full focus-within:ring-2 ring-blue-500/20 transition-all">
            <Search className="w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search apps or data..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-gray-500"
            />
          </div>
          
          <div className="flex items-center gap-3 relative">
            {/* Notifications Button */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-black" />
              </button>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-6 z-[100] backdrop-blur-xl"
                  >
                    <h3 className="font-bold mb-4">Alertas Recientes</h3>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold">Stock Crítico</p>
                          <p className="text-[10px] text-gray-500">SKU-2055 por debajo del mínimo.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold">Línea A1 - OEE 85%</p>
                          <p className="text-[10px] text-gray-500">Rendimiento por debajo del objetivo.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Button */}
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all"
              >
                SV
              </button>

              {/* User Menu Dropdown */}
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-4 z-[100] backdrop-blur-xl"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 mb-2 text-center">
                      <p className="font-bold text-sm">Sergio Valle</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Administrator</p>
                    </div>
                    <div className="space-y-1">
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs transition-colors flex items-center gap-3">
                        <User className="w-4 h-4" /> Account Settings
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs transition-colors flex items-center gap-3">
                        <Settings className="w-4 h-4" /> System Preferences
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-xl text-xs transition-colors flex items-center gap-3"
                      >
                        <Lock className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content (Springboard Style) */}
      <main className="pt-32 pb-20 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto">
        
        {/* Welcome Header */}
        <header className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2 className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
              Hola, Sergio. <br />
              <span className="text-gray-400">Bienvenido a Axos OS.</span>
            </h1>
          </motion.div>
        </header>

        {/* Quick Access Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-10">
          {filteredApps.map((app, i) => (
            <Link href={app.href} key={app.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.5, type: "spring" }}
                whileHover={{ y: -10, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group flex flex-col items-center cursor-pointer"
              >
                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-[2rem] ${app.color} shadow-xl shadow-black/5 flex items-center justify-center transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-black/10 dark:group-hover:shadow-white/5`}>
                  {app.icon}
                </div>
                <span className="mt-4 font-bold text-sm md:text-base tracking-tight">{app.name}</span>
                <span className="text-[10px] md:text-xs text-gray-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {app.description}
                </span>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* System Widgets */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-bold">System Status</h3>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">99.8%</p>
                <p className="text-xs text-gray-400">Up-time across 4 plants</p>
              </div>
              <div className="w-32 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl overflow-hidden flex items-end gap-1 p-2">
                {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-500/30 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-white/5"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="font-bold">Active Alerts</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Low stock on SKU-2055 (Critical)</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Production Line A1 running at 85%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Dock (iOS Style) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 backdrop-blur-2xl bg-white/30 dark:bg-black/30 border border-white/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex items-center gap-8">
        <button className="p-3 hover:scale-110 active:scale-95 transition-all text-gray-600 dark:text-gray-300">
          <Settings className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setIsAppSwitcherOpen(true)}
          className="p-4 bg-black dark:bg-white rounded-3xl shadow-xl hover:scale-110 active:scale-90 transition-all"
        >
          <LayoutGrid className="w-8 h-8 text-white dark:text-black" />
        </button>
        <button className="p-3 hover:scale-110 active:scale-95 transition-all text-gray-600 dark:text-gray-300">
          <User className="w-6 h-6" />
        </button>
      </div>

      {/* App Switcher (Half-Screen Drawer Style) */}
      <AnimatePresence>
        {isAppSwitcherOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAppSwitcherOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: "20%" }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 bg-white dark:bg-[#0A0A0A] rounded-t-[3rem] shadow-2xl z-[70] p-10 overflow-auto"
            >
              <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-10" />
              <h2 className="text-3xl font-bold mb-8 text-center">Axos Applications</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
                {filteredApps.map((app) => (
                  <Link href={app.href} key={app.id} onClick={() => setIsAppSwitcherOpen(false)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-20 h-20 rounded-[1.8rem] ${app.color} flex items-center justify-center shadow-lg`}>
                        {app.icon}
                      </div>
                      <span className="mt-3 font-bold text-sm">{app.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
