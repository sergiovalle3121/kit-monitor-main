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
    const initAuth = async () => {
      const token = localStorage.getItem('axos_access_token');

      if (token && applyToken(token, { requireRole: true })) {
        setIsLoading(false);
        return;
      }
      localStorage.removeItem('axos_access_token');

      // No valid backend token yet. If the user has a frontend session, bridge
      // it to a backend JWT so data calls become authenticated. Best-effort:
      // a failure here never blocks the app (it just stays in "sin acceso").
      try {
        const res = await fetch('/api/backend/token', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.access_token) applyToken(data.access_token);
        }
      } catch {
        /* backend unreachable — leave unauthenticated */
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [applyToken]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      const permissionString = `${resource}:${action}`;
      return permissions.includes(permissionString);
    },
    [permissions],
  );

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (roleName: string): boolean => {
      return roles.some((role) => role === roleName);
    },
    [roles],
  );

  /**
   * Login function
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/login`, {
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
