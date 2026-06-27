import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineeringDocument } from './entities/engineering-document.entity';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EngineeringDocument])],
  controllers: [EngineeringController],
  providers: [
    EngineeringService,
    provideTenantScopedRepository(EngineeringDocument),
  ],
  exports: [EngineeringService],
})
export class EngineeringModule {}
