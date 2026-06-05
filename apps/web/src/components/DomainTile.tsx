'use client';

import React from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Domain } from '@/config/domains';
import { glass } from '@/lib/glass';
import { item } from '@/lib/motion';

interface DomainTileProps {
  domain: Domain;
  onClick: () => void;
}

export function DomainTile({ domain, onClick }: DomainTileProps) {
  const IconComponent = Icons[domain.icon as keyof typeof Icons] as LucideIcon | undefined;
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={item}
      whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`
        ${glass}
        relative flex w-full aspect-square flex-col items-center justify-center
        rounded-[24px] p-2
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70
        will-change-transform
      `}
    >
      <div className={`mb-3 ${domain.accent}`}>
        {IconComponent && <IconComponent className="w-10 h-10" strokeWidth={1.5} />}
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center px-2">
        {domain.name}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center px-2">
        {domain.subtitle}
      </span>
    </motion.button>
  );
}
