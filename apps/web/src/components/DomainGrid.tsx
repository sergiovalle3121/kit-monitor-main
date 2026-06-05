'use client';

import React from 'react';
import { Domain, LAYERS } from '@/config/domains';
import { DomainTile } from './DomainTile';
import { useRouter } from 'next/navigation';

interface DomainGridProps {
  domains: Domain[];
}

export function DomainGrid({ domains }: DomainGridProps) {
  const router = useRouter();

  // Agrupar dominios por capa
  const groupedDomains = domains.reduce((acc, domain) => {
    if (!acc[domain.layer]) {
      acc[domain.layer] = [];
    }
    acc[domain.layer].push(domain);
    return acc;
  }, {} as Record<string, Domain[]>);

  // Ordenar capas
  const sortedLayers = Object.keys(groupedDomains).sort(
    (a, b) => LAYERS[a as keyof typeof LAYERS].order - LAYERS[b as keyof typeof LAYERS].order
  );

  return (
    <div className="space-y-8">
      {sortedLayers.map((layerKey) => {
        const layer = layerKey as keyof typeof LAYERS;
        const layerDomains = groupedDomains[layer];
        const layerInfo = LAYERS[layer];

        return (
          <div key={layer} className="space-y-4">
            {/* Encabezado de capa - discreto */}
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {layerInfo.label}
            </h2>
            
            {/* Rejilla de dominios */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {layerDomains.map((domain) => (
                <DomainTile
                  key={domain.id}
                  domain={domain}
                  onClick={() => router.push(`/dashboard/${domain.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
