import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  /** Internal user ID (string to support both numeric and UUID keys) */
  userId?: string;
  actorName?: string;
  /**
   * Buildings this user is scoped to.
   * Empty array = unrestricted access (superadmin / full-scope user).
   */
  buildings?: string[];
  programs?: string[]
  lines?: number[];
  warehouses?: string[];
}

/**
 * TenantContextService
 *
 * Provides request-scoped organizational context via AsyncLocalStorage.
 * Each incoming HTTP request carries its own isolated context populated by
 * TenantMiddleware from the decoded JWT payload.
 *
 * Usage in services:
 *   const ctx = this.tenantCtx.get();
 *   if (ctx?.buildings?.length) qb.andWhere('...building IN (:...b)', { b: ctx.buildings });
 *
 * Usage in guards / middleware:
 *   this.tenantCtx.run({ userId, buildings }, () => next.handle());
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  /** Run a function inside an isolated tenant context. */
  run<T>(context: TenantContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  /** Returns the current context (undefined outside a run() boundary). */
  get(): TenantContext | undefined {
    return this.als.getStore();
  }

  // ── Convenience accessors ─────────────────────────────────────────────

  get userId(): string | undefined {
    return this.get()?.userId;
  }

  get actorName(): string | undefined {
    return this.get()?.actorName;
  }

  /**
   * Returns scoped buildings.
   * An empty array means "no restriction" (unrestricted access).
   */
  get buildings(): string[] {
    return this.get()?.buildings ?? [];
  }

  get programs(): string[] {
    return this.get()?.programs ?? [];
  }

  get lines(): number[] {
    return this.get()?.lines ?? [];
  }

  get warehouses(): string[] {
    return this.get()?.warehouses ?? [];
  }

  // ── Guard helpers ─────────────────────────────────────────────────────

  /**
   * Returns true if the current context allows access to a given building.
   * An empty scope list means unrestricted — all buildings are allowed.
   */
  allowsBuilding(buildingId: string): boolean {
    const scope = this.buildings;
    return scope.length === 0 || scope.includes(buildingId);
  }

  allowsProgram(programId: string): boolean {
    const scope = this.programs;
    return scope.length === 0 || scope.includes(programId);
  }

  allowsLine(lineNumber: number): boolean {
    const scope = this.lines;
    return scope.length === 0 || scope.includes(lineNumber);
  }

  /** True when a user has a restricted (non-empty) organizational scope. */
  get isScoped(): boolean {
    return (
      this.buildings.length > 0 ||
      this.programs.length > 0 ||
      this.lines.length > 0
    );
  }
}
