import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlantsController } from './controllers/plants.controller';
import { RolesController } from './controllers/roles.controller';
import { SeedController } from './controllers/seed.controller';
import { UserRolesController } from './controllers/user-roles.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    UsersModule,
    GovernanceModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController, PlantsController, RolesController, SeedController, UserRolesController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
