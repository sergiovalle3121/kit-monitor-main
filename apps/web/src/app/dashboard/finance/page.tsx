'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function FinancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Glassmorphism Container */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-12 max-w-2xl w-full overflow-hidden"
      >
        {/* Ambient Glow Effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/30 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, duration: 0.8, type: 'spring', stiffness: 100 }}
            className="inline-flex items-center justify-center w-24 h-24 mb-8 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 border border-emerald-300/30 shadow-lg shadow-emerald-500/20"
          >
            <DollarSign className="w-12 h-12 text-emerald-300" strokeWidth={1.5} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-4xl md:text-5xl font-light tracking-wide text-white mb-4"
          >
            Financial Intelligence Hub
          </motion.h1>

          {/* Subtitle / Welcome Message */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl md:text-2xl font-extralight tracking-[0.2em] text-emerald-200/90 mb-12 uppercase"
          >
            Monetizing Industrial Performance
          </motion.p>

          {/* Decorative Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="w-32 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent mx-auto mb-12"
          />

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                whileTap={{ scale: 0.95 }}
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-medium tracking-wide backdrop-blur-sm shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
                <span>Back to Dashboard</span>
              </motion.button>
            </Link>
          </motion.div>
        </div>

        {/* Bottom Gradient Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      </motion.div>
    </div>
  );
}
