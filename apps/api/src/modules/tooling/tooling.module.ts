import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tool } from './entities/tool.entity';
import { ToolingService } from './tooling.service';
import { ToolingController } from './tooling.controller';
import { NumberingModule } from '../numbering/numbering.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Tooling / molds & fixtures (NPI / Process). Self-contained additive area that
 * consumes the central numbering service for tool folios and tracks shot life.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Tool]),
    NumberingModule,
    EventLedgerModule,
  ],
  controllers: [ToolingController],
  providers: [ToolingService],
  exports: [ToolingService],
})
export class ToolingModule {}
