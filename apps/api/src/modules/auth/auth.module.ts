import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlantsController } from './controllers/plants.controller';
import { RolesController } from './controllers/roles.controller';
import { SeedController } from './controllers/seed.controller';
import { UserRolesController } from './controllers/user-roles.controller';
import { TCodeController } from './controllers/tcode.controller';
import { TCodeService } from './services/tcode.service';
import { AuthorizationService } from './services/authorization.service';
import { RolesSeederService } from './services/roles-seeder.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { GovernanceModule } from '../governance/governance.module';
import { User } from '../users/entities/user.entity';
import { Plant } from './entities/plant.entity';
import { Tenant } from './entities/tenant.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRoleAssignment } from './entities/user-role.entity';
import { getJwtSecret } from '../../common/config/jwt-secret';

@Module({
  imports: [
    UsersModule,
    GovernanceModule,
    PassportModule,
    TypeOrmModule.forFeature([
      User,
      Plant,
      Tenant,
      Role,
      Permission,
      RolePermission,
      UserRoleAssignment,
    ]),
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [
    AuthController,
    PlantsController,
    RolesController,
    SeedController,
    UserRolesController,
    TCodeController,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    TCodeService,
    AuthorizationService,
    RolesSeederService,
  ],
  exports: [AuthService, TCodeService, AuthorizationService],
})
export class AuthModule {}
