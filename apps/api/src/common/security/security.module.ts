import { Global, Module } from '@nestjs/common';
import { GovernanceModule } from '../../modules/governance/governance.module';
import { PermissionsGuard } from '../../modules/auth/guards/permissions.guard';

/**
 * Global security wiring.
 *
 * `PermissionsGuard` is used as a class reference in `@UseGuards(...)` across
 * every controller, and it injects `AuditService` (provided by GovernanceModule).
 * Without a global provision, each feature module would have to import
 * GovernanceModule just to satisfy the guard — and forgetting it crashes the app
 * at bootstrap (not caught by tsc or unit tests).
 *
 * Making the guard a @Global provider — and re-exporting GovernanceModule so
 * `AuditService` is globally resolvable — means any controller in any module can
 * use `@UseGuards(PermissionsGuard)` with zero extra imports.
 */
@Global()
@Module({
  imports: [GovernanceModule],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard, GovernanceModule],
})
export class SecurityModule {}
