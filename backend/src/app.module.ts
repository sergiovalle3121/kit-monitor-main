import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ormOptions } from "./orm.options";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";

// Habilita DB si tienes envs: DATABASE_URL o DB_HOST
const enableDb =
  (process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0) ||
  (process.env.DB_HOST && process.env.DB_HOST.length > 0);

const dbImports = enableDb ? [TypeOrmModule.forRoot(ormOptions())] : [];

@Module({
  imports: [...dbImports, AuthModule, UsersModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
