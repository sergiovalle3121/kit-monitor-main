import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR } from './entities/scar.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier, SCAR]),
    EventLedgerModule
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
