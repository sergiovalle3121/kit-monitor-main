import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandlingUnit } from './entities/handling-unit.entity';
import { PackingService } from './packing.service';
import { PackingController } from './packing.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { TestFlowModule } from '../test-flow/test-flow.module';

/**
 * Packing (Empaque) — handling units (pallet/carton) + GS1 SSCC + ZPL labels.
 * Additive, tenant-scoped (`packing_*`). Consumes the central numbering service
 * for SSCC serials; references shipments by id so it stays self-contained.
 */
@Module({
  imports: [TypeOrmModule.forFeature([HandlingUnit]), NumberingModule, TestFlowModule],
  controllers: [PackingController],
  providers: [PackingService],
  exports: [PackingService],
})
export class PackingModule {}
