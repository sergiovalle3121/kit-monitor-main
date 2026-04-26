"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Activity, 
  Box, 
  ChevronRight, 
  Cpu, 
  Layers, 
  LayoutDashboard, 
  ShieldCheck, 
  Zap 
} from "lucide-react";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 premium-glass px-6 py-4 flex justify-between items-center border-b border-gray-200/50 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white dark:text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight">AXOS <span className="font-light text-gray-500">OS</span></span>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Platform</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Solutions</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Enterprise</a>
          </div>
          <Link href="/dashboard" className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 dark:shadow-white/5">
            Launch Console
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-6xl mx-auto text-center"
        >
          <motion.div 
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-400 mb-8"
          >
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>Multi-tenant Enterprise Architecture</span>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]"
          >
            Industrial Intelligence. <br />
            <span className="text-gray-400 dark:text-gray-600">Perfected.</span>
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12 font-light"
          >
            The next-generation Operating System for manufacturing. 
            Real-time MES, intelligent ERP, and predictive logistics in a single premium experience.
          </motion.p>
          
          <motion.div 
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/login" className="group px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-lg font-medium flex items-center gap-2 hover:shadow-2xl transition-all">
              Get Started
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/dashboard/forecast" className="px-8 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-lg font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
              View Demo
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-white dark:bg-black/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <LayoutDashboard />, title: "Control Tower", desc: "Full visibility of your global operations with real-time KPIs." },
              { icon: <Box />, title: "Smart Inventory", desc: "Automated replenishment and shortage prediction driven by AI." },
              { icon: <Activity />, title: "MES Engine", desc: "High-precision manufacturing execution with millisecond latency." },
              { icon: <Zap />, title: "Predictive Ops", desc: "Avoid line stops before they happen with Monte Carlo simulations." },
              { icon: <Cpu />, title: "Core Architecture", desc: "NestJS & Next.js power a robust modular monolith." },
              { icon: <Layers />, title: "Multi-tenant", desc: "B2B SaaS ready from day one with enterprise-grade isolation." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="p-8 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-light leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100 dark:border-white/5 text-center">
        <p className="text-sm text-gray-400 font-light">© 2026 AXOS OS. Engineering Excellence.</p>
      </footer>
    </main>
  );
}
