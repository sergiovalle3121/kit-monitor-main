import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from '../plans/entities/plan.entity';
import { MesStagingLine } from './entities/mes-staging-line.entity';
import { MaterialStagingMesService } from './material-staging-mes.service';
import { MaterialStagingMesController } from './material-staging-mes.controller';
import { PickListModule } from '../pick-lists/pick-list.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { GovernanceModule } from '../governance/governance.module';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Carril 1 (puente MES) del kitteador — capa SEPARADA y aditiva.
 *
 * NO importa ni modifica MaterialStagingModule (carril 2): el carril 2
 * (generate, wo/:woId, replenish, kpis, confirm, shortage) sigue intacto.
 * Reúsa PickListService (carril 1 ya existente) para el pick-list por plan y
 * persiste el surtido en su propia tabla (`sf_mes_staging`).
 *
 * Retirar el puente (Forma 2) = borrar este módulo + sus archivos y la línea de
 * registro en app.module — sin desenredar nada del carril 2.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, MesStagingLine]),
    PickListModule, // PickListService.getByPlan(planId)
    EventLedgerModule, // auditoría best-effort
    GovernanceModule, // AuditService requerido por PermissionsGuard
  ],
  controllers: [MaterialStagingMesController],
  providers: [
    MaterialStagingMesService,
    provideTenantScopedRepository(MesStagingLine),
  ],
  exports: [MaterialStagingMesService],
})
export class MaterialStagingMesModule {}
