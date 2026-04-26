'use client';

import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Settings, 
  BarChart3, 
  Cpu, 
  Zap,
  Activity,
  Database,
  Shield,
  Bell
} from 'lucide-react';
import Link from 'next/link';

interface AppItem {
  name: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const apps: AppItem[] = [
  {
    name: 'Finance',
    icon: <DollarSign className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/finance',
    color: 'from-emerald-400 to-cyan-400'
  },
  {
    name: 'Analytics',
    icon: <BarChart3 className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/analytics',
    color: 'from-blue-400 to-indigo-400'
  },
  {
    name: 'Performance',
    icon: <Activity className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/performance',
    color: 'from-orange-400 to-red-400'
  },
  {
    name: 'Systems',
    icon: <Cpu className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/systems',
    color: 'from-purple-400 to-pink-400'
  },
  {
    name: 'Energy',
    icon: <Zap className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/energy',
    color: 'from-yellow-400 to-amber-400'
  },
  {
    name: 'Data',
    icon: <Database className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/data',
    color: 'from-teal-400 to-green-400'
  },
  {
    name: 'Security',
    icon: <Shield className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/security',
    color: 'from-slate-400 to-gray-400'
  },
  {
    name: 'Alerts',
    icon: <Bell className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/alerts',
    color: 'from-rose-400 to-red-400'
  },
  {
    name: 'Settings',
    icon: <Settings className="w-8 h-8" strokeWidth={1.5} />,
    href: '/dashboard/settings',
    color: 'from-zinc-400 to-neutral-400'
  }
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl md:text-5xl font-light tracking-wider text-white mb-2">
          AXOS OS
        </h1>
        <p className="text-slate-400 font-extralight tracking-[0.3em] text-sm uppercase">
          Industrial Performance Platform
        </p>
      </motion.header>

      {/* App Grid - iPhone Style Carousel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="max-w-4xl mx-auto"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6 md:gap-8">
          {apps.map((app, index) => (
            <Link key={app.name} href={app.href}>
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  delay: 0.1 * index, 
                  duration: 0.5,
                  type: 'spring',
                  stiffness: 100
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-3 cursor-pointer group"
              >
                {/* App Icon */}
                <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-gradient-to-br ${app.color} p-0.5 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                  <div className="w-full h-full rounded-2xl md:rounded-3xl bg-slate-900/90 backdrop-blur-sm flex items-center justify-center text-white">
                    {app.icon}
                  </div>
                </div>
                
                {/* App Name */}
                <span className="text-xs md:text-sm font-light text-slate-300 tracking-wide group-hover:text-white transition-colors duration-300">
                  {app.name}
                </span>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Bottom Status Bar */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="fixed bottom-0 left-0 right-0 py-4 px-8 backdrop-blur-xl bg-slate-900/50 border-t border-white/10"
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center text-slate-400 text-xs tracking-wider">
          <span>AXOS OS v2.0</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
