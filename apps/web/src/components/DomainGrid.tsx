'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Domain, LAYERS } from '@/config/domains';
import { DomainTile } from './DomainTile';
import { Shelf } from './Shelf';
import { container } from '@/lib/motion';
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
    (a, b) => LAYERS[a as keyof typeof LAYERS].order - LAYERS[b as keyof typeof LAYERS].order,
  );

  return (
    <div className="space-y-10">
      {sortedLayers.map((layerKey) => {
        const layer = layerKey as keyof typeof LAYERS;
        const layerDomains = groupedDomains[layer];
        const layerInfo = LAYERS[layer];

        return (
          <motion.section
            key={layer}
            className="space-y-4"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {/* Encabezado de capa - section header sutil de iOS */}
            <h2 className="text-sm font-medium tracking-wide text-gray-500 dark:text-gray-400">
              {layerInfo.label}
            </h2>

            {/* Estante horizontal de dominios */}
            <Shelf ariaLabel={layerInfo.label} itemWidth={208}>
              {layerDomains.map((domain) => (
                <DomainTile
                  key={domain.id}
                  domain={domain}
                  onClick={() => router.push(`/dashboard/${domain.id}`)}
                />
              ))}
            </Shelf>
          </motion.section>
        );
      })}
    </div>
  );
}
