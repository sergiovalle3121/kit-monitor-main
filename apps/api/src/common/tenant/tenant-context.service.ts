import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenant_id: string | null;
  organization_id: string | null;
  plant_id: string | null;
  user_email: string;
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
}
