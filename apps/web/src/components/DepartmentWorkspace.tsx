'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { glass } from '@/lib/glass';
import { containerRM, itemRM, hoverRM, pressRM } from '@/lib/motion';

const MotionLink = motion.create(Link);

export interface WsKpi {
  label: string;
  value: React.ReactNode;
  color?: string;
}
export interface WsTool {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  color: string;
  tint: string;
}

/**
 * Plantilla reutilizable de "workspace de departamento": cabecera, KPIs en vivo y
 * un lanzador de herramientas (cada tile abre una pantalla real). Mantiene el
 * patrón "un departamento = una pantalla con varias herramientas" y respeta
 * prefers-reduced-motion.
 */
export function DepartmentWorkspace({
  title,
  subtitle,
  icon,
  iconClass,
  iconTint,
  kpis = [],
  tools,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass: string;
  iconTint: string;
  kpis?: WsKpi[];
  tools: WsTool[];
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const Icon = icon;

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <header className="flex items-center gap-3 mb-8">
          <div className={`p-3 rounded-2xl ${iconTint}`}><Icon className={`w-7 h-7 ${iconClass}`} strokeWidth={1.5} /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{subtitle}</p>
          </div>
        </header>

        {kpis.length > 0 && (
          <motion.section variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {kpis.map((k) => (
              <motion.div key={k.label} variants={itemRM(reduce)} className={`${glass} rounded-3xl p-5`}>
                <div className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: k.color }}>{k.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{k.label}</div>
              </motion.div>
            ))}
          </motion.section>
        )}

        <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Herramientas</h2>
        <motion.section variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {tools.map((t) => {
            const TI = t.icon;
            return (
              <MotionLink key={t.href + t.title} href={t.href} variants={itemRM(reduce)} whileHover={hoverRM(reduce)} whileTap={pressRM(reduce)} className={`${glass} rounded-3xl p-5 flex items-center gap-4`}>
                <div className={`inline-flex p-3 rounded-2xl ${t.tint} flex-shrink-0`}><TI className={`w-6 h-6 ${t.color}`} strokeWidth={1.5} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{t.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </MotionLink>
            );
          })}
        </motion.section>

        {children}
      </main>
    </div>
  );
}
