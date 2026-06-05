'use client';

import React from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Domain } from '@/config/domains';

interface DomainTileProps {
  domain: Domain;
  onClick: () => void;
}

export function DomainTile({ domain, onClick }: DomainTileProps) {
  const IconComponent = Icons[domain.icon as keyof typeof Icons] as LucideIcon | undefined;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        w-full aspect-square
        ${domain.tint}
        rounded-3xl
        shadow-sm hover:shadow-md
        transition-all duration-200
        hover:scale-[1.02]
        group
      `}
    >
      <div className={`mb-3 ${domain.accent}`}>
        {IconComponent && <IconComponent className="w-10 h-10" strokeWidth={1.5} />}
      </div>
      <span className="text-sm font-semibold text-gray-900 text-center px-2">
        {domain.name}
      </span>
      <span className="text-xs text-gray-500 mt-1 text-center px-2">
        {domain.subtitle}
      </span>
    </button>
  );
}
