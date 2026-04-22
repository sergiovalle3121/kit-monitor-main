import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitException } from './entities/kit-exception.entity';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';

import { EventLedgerModule } from '../event-ledger/event-ledger.module';
import { Kit } from '../kits/entities/kit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([KitException, Kit]),
    EventLedgerModule,
  ],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
