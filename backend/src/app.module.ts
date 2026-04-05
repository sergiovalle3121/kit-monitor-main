import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ormOptions } from "./orm.options";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
// Kit Monitor domain modules
import { PlansModule } from "./modules/plans/plans.module";
import { BomModule } from "./modules/bom/bom.module";
import { BayLayoutModule } from "./modules/bay-layout/bay-layout.module";
import { KitsModule } from "./modules/kits/kits.module";
import { KitMaterialsModule } from "./modules/kit-materials/kit-materials.module";
import { AdvancesModule } from "./modules/advances/advances.module";
import { ResuppliesModule } from "./modules/resupplies/resupplies.module";
import { ExceptionsModule } from "./modules/exceptions/exceptions.module";
import { ProductionRuntimeModule } from "./modules/production-runtime/production-runtime.module";
import { DecisionIntelligenceModule } from "./modules/decision-intelligence/decision-intelligence.module";
import { CancellationRequestsModule } from "./modules/cancellation-requests/cancellation-requests.module";

// TypeOrmModule always loads: uses SQLite (dev.sqlite) when no PG env vars,
// PostgreSQL when DATABASE_URL or DB_HOST is set. See orm.options.ts.
@Module({
  imports: [
    TypeOrmModule.forRoot(ormOptions()),
    AuthModule,
    UsersModule,
    PlansModule,
    BomModule,
    BayLayoutModule,
    KitsModule,
    KitMaterialsModule,
    AdvancesModule,
    ResuppliesModule,
    ExceptionsModule,
    ProductionRuntimeModule,
    DecisionIntelligenceModule,
    CancellationRequestsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
