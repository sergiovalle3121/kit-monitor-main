'use client';

import React from 'react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SubApp } from '@/config/domains';
import { useRouter } from 'next/navigation';

interface SubAppTileProps {
  subApp: SubApp;
  domainId: string;
}

export function SubAppTile({ subApp, domainId }: SubAppTileProps) {
  const router = useRouter();
  const IconComponent = Icons[subApp.icon as keyof typeof Icons] as LucideIcon | undefined;

  return (
    <button
      onClick={() => router.push(`/dashboard/${domainId}/${subApp.id}`)}
      className="
        relative flex flex-col items-center justify-center
        w-full aspect-square
        bg-white
        rounded-2xl
        shadow-sm hover:shadow-md
        transition-all duration-200
        hover:scale-[1.02]
        border border-gray-100
        group
      "
    >
      <div className="mb-3 text-gray-700 group-hover:text-gray-900">
        {IconComponent && <IconComponent className="w-8 h-8" strokeWidth={1.5} />}
      </div>
      <span className="text-sm font-medium text-gray-900 text-center px-2">
        {subApp.name}
      </span>
    </button>
  );
}
