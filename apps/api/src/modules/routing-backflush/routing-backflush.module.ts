import { Module } from '@nestjs/common';
import { RoutingBackflushService } from './routing-backflush.service';
import { RoutingBackflushController } from './routing-backflush.controller';
import { RoutingModule } from '../routing/routing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EventLedgerModule } from '../event-ledger/event-ledger.module';

/**
 * Routing-driven backflush — turns the BOM↔routing bridge (rt_operation_material)
 * into real consumption. Additive: a new module that reuses RoutingService (read)
 * and the existing InventoryService.recordTransaction (write), without touching
 * the live operator terminal. No new tables.
 */
@Module({
  imports: [RoutingModule, InventoryModule, EventLedgerModule],
  controllers: [RoutingBackflushController],
  providers: [RoutingBackflushService],
  exports: [RoutingBackflushService],
})
export class RoutingBackflushModule {}
