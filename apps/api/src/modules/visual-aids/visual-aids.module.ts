import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisualAid } from './entities/visual-aid.entity';
import { VisualAidsController } from './visual-aids.controller';
import { VisualAidsService } from './visual-aids.service';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([VisualAid, EnterpriseProgram])],
  controllers: [VisualAidsController],
  providers: [VisualAidsService, provideTenantScopedRepository(VisualAid)],
  exports: [VisualAidsService],
})
export class VisualAidsModule {}
