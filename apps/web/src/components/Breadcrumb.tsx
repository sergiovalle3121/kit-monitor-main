'use client';

import React from 'react';
import { Domain } from '@/config/domains';
import * as Icons from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbProps {
  domain?: Domain;
  subAppName?: string;
}

export function Breadcrumb({ domain, subAppName }: BreadcrumbProps) {
  if (!domain && !subAppName) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
      <Link href="/dashboard" className="hover:text-gray-700 transition-colors">
        Dashboard
      </Link>
      
      {domain && (
        <>
          <span className="text-gray-300">›</span>
          <Link 
            href={`/dashboard/${domain.id}`} 
            className="hover:text-gray-700 transition-colors font-medium text-gray-700"
          >
            {domain.name}
          </Link>
        </>
      )}
      
      {subAppName && domain && (
        <>
          <span className="text-gray-300">›</span>
          <span className="font-medium text-gray-900">{subAppName}</span>
        </>
      )}
    </nav>
  );
}
