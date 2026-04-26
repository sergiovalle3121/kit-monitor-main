import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { UserScopes } from '../types/jwt.types';

export interface TenantContext {
  tenant_id: string | null;
  organization_id: string | null;
  plant_id: string | null;
  user_email: string;
  role: string | null;
  permissions: string[] | null;
  scopes: UserScopes | null;
}

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): TenantContext | undefined {
    return this.storage.getStore();
  }

  getTenantId(): string | null {
    return this.storage.getStore()?.tenant_id ?? null;
  }

  getOrganizationId(): string | null {
    return this.storage.getStore()?.organization_id ?? null;
  }

  getPlantId(): string | null {
    return this.storage.getStore()?.plant_id ?? null;
  }

  getUserEmail(): string {
    return this.storage.getStore()?.user_email ?? 'anonymous';
  }

  getRole(): string | null {
    return this.storage.getStore()?.role ?? null;
  }

  getPermissions(): string[] | null {
    return this.storage.getStore()?.permissions ?? null;
  }

  getScopes(): UserScopes | null {
    return this.storage.getStore()?.scopes ?? null;
  }

  /** Convenience: IDs of buildings this user can access. Empty = no restriction. */
  getAllowedBuildingIds(): string[] {
    return this.storage.getStore()?.scopes?.buildings ?? [];
  }

  hasPermission(permission: string): boolean {
    return this.storage.getStore()?.permissions?.includes(permission) ?? false;
  }

  isAdmin(): boolean {
    return this.storage.getStore()?.role === 'Admin';
  }
}
