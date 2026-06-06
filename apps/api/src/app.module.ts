import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ormOptions } from './orm.options';
import { HealthController } from './health/health.controller';
import { TenantModule } from './common/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ForecastModule } from './modules/forecast/forecast.module';

// AXOS OS Intelligence & Tenancy Infrastructure
import { EventLedgerInterceptor } from './common/interceptors/event-ledger.interceptor';
import { TenantSubscriber } from './common/database/tenant.subscriber';

// AXOS OS domain modules
import { PlansModule } from './modules/plans/plans.module';
import { BomModule } from './modules/bom/bom.module';
import { BayLayoutModule } from './modules/bay-layout/bay-layout.module';
import { KitsModule } from './modules/kits/kits.module';
import { KitMaterialsModule } from './modules/kit-materials/kit-materials.module';
import { PickListModule } from './modules/pick-lists/pick-list.module';
import { MaterialRequestsModule } from './modules/material-requests/material-requests.module';
import { AdvancesModule } from './modules/advances/advances.module';
import { ResuppliesModule } from './modules/resupplies/resupplies.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { ProductionRuntimeModule } from './modules/production-runtime/production-runtime.module';
import { DecisionIntelligenceModule } from './modules/decision-intelligence/decision-intelligence.module';
import { CancellationRequestsModule } from './modules/cancellation-requests/cancellation-requests.module';
import { VisualAidsModule } from './modules/visual-aids/visual-aids.module';
import { EventLedgerModule } from './modules/event-ledger/event-ledger.module';
import { EnterpriseCampusModule } from './modules/enterprise-campus/enterprise-campus.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { QualityModule } from './modules/quality/quality.module';
import { NcrModule } from './modules/ncr/ncr.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ReceivingModule } from './modules/receiving/receiving.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { EngineeringModule } from './modules/engineering/engineering.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { CostRollupModule } from './modules/cost-rollup/cost-rollup.module';
import { AutopilotModule } from './modules/autopilot/autopilot.module';
import { SignalModule } from './common/gateway/signal.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ProcessRoutingModule } from './modules/process-routing/process-routing.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(ormOptions()),
    TenantModule,
    AuthModule,
    UsersModule,
    ForecastModule,
    PlansModule,
    BomModule,
    BayLayoutModule,
    KitsModule,
    KitMaterialsModule,
    PickListModule,
    MaterialRequestsModule,
    AdvancesModule,
    ResuppliesModule,
    ExceptionsModule,
    ProductionRuntimeModule,
    DecisionIntelligenceModule,
    CancellationRequestsModule,
    VisualAidsModule,
    EventLedgerModule,
    EnterpriseCampusModule,
    InventoryModule,
    QualityModule,
    NcrModule,
    SuppliersModule,
    ReceivingModule,
    ShippingModule,
    GovernanceModule,
    EngineeringModule,
    AccountingModule,
    CostRollupModule,
    AutopilotModule,
    SignalModule,
    MessagingModule,
    ProcessRoutingModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: EventLedgerInterceptor,
    },
    TenantSubscriber,
  ],
})
export class AppModule {}
