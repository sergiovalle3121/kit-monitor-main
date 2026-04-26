import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { GovernanceModule } from '../governance/governance.module';
import { AuthorizationService } from './services/authorization.service';
import { RolesSeederService } from './services/roles-seeder.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesController } from './controllers/roles.controller';
import { UserRolesController } from './controllers/user-roles.controller';
import { SeedController } from './controllers/seed.controller';

// Entities
import { Tenant } from './entities/tenant.entity';
import { Plant } from './entities/plant.entity';
import { User } from '../users/entities/user.entity'; // Points to unified entity
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRoleAssignment } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';

@Module({
  imports: [
    UsersModule,
    GovernanceModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1d' },
    }),
    // Register all auth-related entities for TypeORM
    TypeOrmModule.forFeature([
      Tenant,
      Plant,
      User,
      Role,
      Permission,
      UserRoleAssignment,
      RolePermission,
    ]),
  ],
  controllers: [AuthController, RolesController, UserRolesController, SeedController],
  providers: [AuthService, JwtStrategy, AuthorizationService, RolesSeederService, PermissionsGuard],
  exports: [AuthService, AuthorizationService, TypeOrmModule],
})
export class AuthModule {}
