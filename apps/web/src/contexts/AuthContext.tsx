'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * User interface representing the authenticated user
 */
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

/**
 * Auth context data structure
 */
interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  plantId: string | null;
  roles: string[];
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (roleName: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

/**
 * JWT Payload structure from backend
 */
interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  tenant_id?: string;
  organization_id?: string;
  plant_id?: string;
  permissions?: string[];
  scopes?: Record<string, unknown>;
  iat: number;
  exp: number;
}

/**
 * Login response structure
 */
interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    username?: string;
    role?: string;
    tenant_id?: string;
    organization_id?: string;
    plant_id?: string;
    permissions?: string[];
    scopes?: Record<string, unknown>;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Helper function to decode JWT token
 */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * AuthProvider component - wraps the app and provides authentication context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize auth state from stored token
   */
  const applyToken = useCallback((token: string, opts?: { requireRole?: boolean }) => {
    const payload = decodeJwt(token);
    if (payload && payload.exp > Date.now() / 1000) {
      // Legacy tokens were signed without role/permissions. Reject those for the
      // stored-token path so we re-bridge and mint a fresh token that carries them.
      if (opts?.requireRole && !payload.role) return false;
      localStorage.setItem('axos_access_token', token);
      setUser({ id: payload.sub, email: payload.email });
      setTenantId(payload.tenant_id || null);
      setPlantId(payload.plant_id || null);
      setRoles(payload.role ? [payload.role] : []);
      setPermissions(payload.permissions || []);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

    // Exchange the frontend cookie session for a fresh backend JWT. Best-effort:
    // a failure never blocks the app (it just stays in "sin acceso").
    const bridge = async (): Promise<boolean> => {
      try {
        const res = await fetch('/api/backend/token', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.access_token) return applyToken(data.access_token);
        }
      } catch {
        /* backend unreachable — leave unauthenticated */
      }
      return false;
    };

    const initAuth = async () => {
      const token = localStorage.getItem('axos_access_token');

      if (token && applyToken(token, { requireRole: true })) {
        // The token looks valid locally (not expired, carries a role), but the
        // backend may reject it (e.g. JWT secret rotated on Railway). Confirm it
        // with a cheap protected call; only on an explicit reject do we discard
        // and re-bridge, so the user is never stuck on a stale token. A network
        // error keeps the token (the data-layer self-heal will cover it).
        try {
          const check = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (check.status === 401 || check.status === 403) {
            localStorage.removeItem('axos_access_token');
            await bridge();
          }
        } catch {
          /* transient network error — keep the token */
        }
        setIsLoading(false);
        return;
      }

      localStorage.removeItem('axos_access_token');
      await bridge();
      setIsLoading(false);
    };

    initAuth();
  }, [applyToken]);

  // Admin/owner is full-access: the backend stores role exactly 'Admin' and the
  // guard bypasses it, so the UI must too (case-insensitive for safety).
  const isAdmin = roles.some((role) => role?.toLowerCase() === 'admin');

  /**
   * Check if user has a specific permission. Admin always passes.
   */
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (isAdmin) return true;
      const permissionString = `${resource}:${action}`;
      return permissions.includes(permissionString);
    },
    [permissions, isAdmin],
  );

  /**
   * Check if user has a specific role (case-insensitive; Admin satisfies any).
   */
  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (isAdmin) return true;
      return roles.some((role) => role?.toLowerCase() === roleName?.toLowerCase());
    },
    [roles, isAdmin],
  );

  /**
   * Login function
   */
  const login = async (email: string, password: string) => {
    try {
      // Same-origin Next route handler (apps/web/src/app/api/auth/login/route.ts),
      // matching the real login page. Avoids the `/api/api/...` double-prefix that
      // results from concatenating `/api/...` onto NEXT_PUBLIC_API_URL when it
      // already ends in `/api` (prod).
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data: LoginResponse = await response.json();
      
      // Store token
      localStorage.setItem('axos_access_token', data.access_token);
      
      // Set user state
      setUser({
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
      });
      setTenantId(data.user.tenant_id || null);
      setPlantId(data.user.plant_id || null);
      setRoles(data.user.role ? [data.user.role] : []);
      setPermissions(data.user.permissions || []);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  /**
   * Logout function
   */
  const logout = () => {
    localStorage.removeItem('axos_access_token');
    setUser(null);
    setTenantId(null);
    setPlantId(null);
    setRoles([]);
    setPermissions([]);
  };

  const value: AuthContextType = {
    user,
    tenantId,
    plantId,
    roles,
    permissions,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    hasPermission,
    hasRole,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
