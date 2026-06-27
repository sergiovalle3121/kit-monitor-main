import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BayLayout } from './entities/bay-layout.entity';
import { BayLayoutService } from './bay-layout.service';
import { BayLayoutController } from './bay-layout.controller';
import { provideTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BayLayout])],
  controllers: [BayLayoutController],
  providers: [BayLayoutService, provideTenantScopedRepository(BayLayout)],
  exports: [BayLayoutService],
})
export class BayLayoutModule {}
