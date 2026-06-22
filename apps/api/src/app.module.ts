import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ormOptions } from './orm.options';
import { HealthController } from './health/health.controller';
import { TenantModule } from './common/tenant/tenant.module';
import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { NumberingModule } from './modules/numbering/numbering.module';
import { ImprovementModule } from './modules/improvement/improvement.module';
import { EhsModule } from './modules/ehs/ehs.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { LegalModule } from './modules/legal/legal.module';
import { TestingModule } from './modules/testing/testing.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PeopleModule } from './modules/people/people.module';
import { HrModule } from './modules/hr/hr.module';
import { ControlTowerModule } from './modules/control-tower/control-tower.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { TrafficModule } from './modules/traffic/traffic.module';
import { PackingModule } from './modules/packing/packing.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { CycleCountsModule } from './modules/cycle-counts/cycle-counts.module';
import { CrmModule } from './modules/crm/crm.module';
import { FixedAssetsModule } from './modules/fixed-assets/fixed-assets.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ToolingModule } from './modules/tooling/tooling.module';
import { RmaModule } from './modules/rma/rma.module';
import { LineEngineeringModule } from './modules/line-engineering/line-engineering.module';
import { ProductionPlanModule } from './modules/production-plan/production-plan.module';
import { MaterialStagingModule } from './modules/material-staging/material-staging.module';
import { MaterialStagingMesModule } from './modules/material-staging/material-staging-mes.module';
import { OperatorTerminalModule } from './modules/operator-terminal/operator-terminal.module';
import { FloorQualityModule } from './modules/floor-quality/floor-quality.module';
import { FaiModule } from './modules/fai/fai.module';
import { ChangeoverModule } from './modules/changeover/changeover.module';
import { GenealogyModule } from './modules/genealogy/genealogy.module';
import { LineControlTowerModule } from './modules/line-control-tower/line-control-tower.module';
import { OeeModule } from './modules/oee/oee.module';
import { LiveModule } from './modules/live/live.module';
import { CostIntelligenceModule } from './modules/cost-intelligence/cost-intelligence.module';

// AXOS OS Intelligence & Tenancy Infrastructure
import { EventLedgerInterceptor } from './common/interceptors/event-ledger.interceptor';
import { TenantSubscriber } from './common/database/tenant.subscriber';

// AXOS OS domain modules
import { PlansModule } from './modules/plans/plans.module';
import { BomModule } from './modules/bom/bom.module';
import { ProductModelsModule } from './modules/product-models/product-models.module';
import { MaterialMasterModule } from './modules/material-master/material-master.module';
import { BomTreeModule } from './modules/bom-tree/bom-tree.module';
import { RoutingModule } from './modules/routing/routing.module';
import { ImportDataModule } from './modules/import-data/import-data.module';
import { ProductCostingModule } from './modules/product-costing/product-costing.module';
import { RoutingBackflushModule } from './modules/routing-backflush/routing-backflush.module';
import { MrpModule } from './modules/mrp/mrp.module';
import { PurchasePlanningModule } from './modules/purchase-planning/purchase-planning.module';
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
import { OfficeModule } from './modules/office/office.module';
import { MesExecutionModule } from './modules/mes-execution/mes-execution.module';
import { ErpCoreModule } from './modules/erp-core/erp-core.module';
import { AiModule } from './modules/ai/ai.module';
import { TestFlowModule } from './modules/test-flow/test-flow.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(ormOptions()),
    TenantModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    NumberingModule,
    ImprovementModule,
    EhsModule,
    MaintenanceModule,
    LegalModule,
    TestingModule,
    ProcurementModule,
    PeopleModule,
    HrModule,
    ControlTowerModule,
    OutboundModule,
    TrafficModule,
    PackingModule,
    InboundModule,
    CycleCountsModule,
    CrmModule,
    FixedAssetsModule,
    ExpensesModule,
    ToolingModule,
    RmaModule,
    LineEngineeringModule,
    ProductionPlanModule,
    MaterialStagingModule,
    MaterialStagingMesModule,
    OperatorTerminalModule,
    FloorQualityModule,
    FaiModule,
    ChangeoverModule,
    GenealogyModule,
    LineControlTowerModule,
    OeeModule,
    LiveModule,
    CostIntelligenceModule,
    ForecastModule,
    PlansModule,
    BomModule,
    ProductModelsModule,
    MaterialMasterModule,
    BomTreeModule,
    RoutingModule,
    ImportDataModule,
    ProductCostingModule,
    RoutingBackflushModule,
    MrpModule,
    PurchasePlanningModule,
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
    OfficeModule,
    MesExecutionModule,
    ErpCoreModule,
    AiModule,
    TestFlowModule,
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
