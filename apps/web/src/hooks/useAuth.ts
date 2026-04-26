'use client';

import { useAuth } from '@/contexts/AuthContext';

/**
 * useAuth hook - re-exports the auth context hook for convenience
 * This provides a single import point for authentication data throughout the app
 */
export function useAuth() {
  return useAuth();
}
