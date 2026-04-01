import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ormOptions } from "./orm.options";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
// Kit Monitor domain modules
import { PlansModule } from "./modules/plans/plans.module";
import { BomModule } from "./modules/bom/bom.module";
import { KitsModule } from "./modules/kits/kits.module";
import { KitMaterialsModule } from "./modules/kit-materials/kit-materials.module";
import { AdvancesModule } from "./modules/advances/advances.module";
import { ResuppliesModule } from "./modules/resupplies/resupplies.module";
import { ExceptionsModule } from "./modules/exceptions/exceptions.module";

const enableDb =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) ||
  (process.env.DB_HOST && process.env.DB_HOST.length > 0);

const dbImports = enableDb ? [TypeOrmModule.forRoot(ormOptions())] : [];

@Module({
  imports: [
    ...dbImports,
    AuthModule,
    UsersModule,
    PlansModule,
    BomModule,
    KitsModule,
    KitMaterialsModule,
    AdvancesModule,
    ResuppliesModule,
    ExceptionsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
