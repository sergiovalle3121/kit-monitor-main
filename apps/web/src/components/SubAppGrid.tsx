'use client';

import React from 'react';
import { SubApp } from '@/config/domains';
import { SubAppTile } from './SubAppTile';

interface SubAppGridProps {
  subApps: SubApp[];
  domainId: string;
}

export function SubAppGrid({ subApps, domainId }: SubAppGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {subApps.map((subApp) => (
        <SubAppTile
          key={subApp.id}
          subApp={subApp}
          domainId={domainId}
        />
      ))}
    </div>
  );
}
