'use client';

import React from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { SubApp } from '@/config/domains';
import { useRouter } from 'next/navigation';
import { glass } from '@/lib/glass';
import { item } from '@/lib/motion';

interface SubAppTileProps {
  subApp: SubApp;
  domainId: string;
}

export function SubAppTile({ subApp, domainId }: SubAppTileProps) {
  const router = useRouter();
  const IconComponent = Icons[subApp.icon as keyof typeof Icons] as LucideIcon | undefined;
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={() => router.push(`/dashboard/${domainId}/${subApp.id}`)}
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
      <div className="mb-3 text-gray-700 dark:text-gray-200">
        {IconComponent && <IconComponent className="w-8 h-8" strokeWidth={1.5} />}
      </div>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center px-2">
        {subApp.name}
      </span>
    </motion.button>
  );
}
