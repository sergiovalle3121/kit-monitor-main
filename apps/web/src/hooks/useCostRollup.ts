'use client';

import useSWR from 'swr';
import { useAuth } from './useAuth';

export type CostCategory =
  | 'mano_de_obra'
  | 'materia_prima'
  | 'energia'
  | 'gastos_fijos';

export type CostItem = {
  id: string;
  tenantId: string;
  workOrderId: string | null;
  category: CostCategory;
  amount: number;
  currency: string;
  description: string;
  recordedAt: string;
};

export type CostBreakdown = {
  category: CostCategory;
  amount: number;
  percentage: number;
};

export type CostRollupResponse = {
  totalCost: number;
  breakdown: CostBreakdown[];
  items: CostItem[];
};

type ApiEnvelope<T> = T | { success: boolean; data: T; timestamp?: string };

type UseCostRollupOptions = {
  workOrderId?: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

function unwrapResponse<T>(payload: ApiEnvelope<T>): T {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    'success' in payload
  ) {
    return payload.data;
  }

  return payload;
}

function buildCostRollupUrl(workOrderId?: string) {
  const params = new URLSearchParams();
  const normalizedWorkOrder = workOrderId?.trim();

  if (normalizedWorkOrder) {
    params.set('workOrderId', normalizedWorkOrder);
  }

  const query = params.toString();
  return `${API_BASE_URL}/api/cost-rollup${query ? `?${query}` : ''}`;
}

async function fetchCostRollup(
  url: string,
  tenantId: string,
): Promise<CostRollupResponse> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('axos_access_token')
      : null;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to load cost rollup data.');
  }

  const payload = (await response.json()) as ApiEnvelope<CostRollupResponse>;
  return unwrapResponse(payload);
}

export function useCostRollup(options: UseCostRollupOptions = {}) {
  const { tenantId, hasPermission, isLoading: isAuthLoading } = useAuth();
  const canReadFinance = hasPermission('finance', 'read');
  const workOrderId = options.workOrderId?.trim();
  const shouldFetch = !isAuthLoading && canReadFinance && Boolean(tenantId);
  const key = shouldFetch
    ? [buildCostRollupUrl(workOrderId), tenantId as string]
    : null;

  const { data, error, isLoading, mutate, isValidating } = useSWR<
    CostRollupResponse,
    Error
  >(
    key,
    ([url, scopedTenantId]) => fetchCostRollup(url, scopedTenantId),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  return {
    data,
    error,
    isLoading: isAuthLoading || isLoading,
    isValidating,
    mutate,
  };
}
