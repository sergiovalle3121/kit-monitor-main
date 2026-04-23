import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReplenishmentRule } from './entities/replenishment-rule.entity';
import { InventoryPosition } from './entities/inventory-position.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseTaskType } from './entities/warehouse-task.entity';

@Injectable()
export class ReplenishmentService {
  constructor(
    @InjectRepository(ReplenishmentRule)
    private readonly ruleRepo: Repository<ReplenishmentRule>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    private readonly warehouseService: WarehouseService,
  ) {}

  async getRules(): Promise<ReplenishmentRule[]> {
    return this.ruleRepo.find();
  }

  async createRule(dto: Partial<ReplenishmentRule>): Promise<ReplenishmentRule> {
    const rule = this.ruleRepo.create(dto);
    return this.ruleRepo.save(rule);
  }

  async analyzeInventory(): Promise<any[]> {
    const rules = await this.ruleRepo.find({ where: { isActive: true } });
    const signals = [];

    for (const rule of rules) {
      // Get total on-hand in destination warehouse
      const positions = await this.positionRepo.find({
        where: { 
          warehouseId: rule.warehouseId, 
          partNumber: rule.partNumber,
          programId: rule.programId 
        }
      });
      
      const currentStock = positions.reduce((acc, p) => acc + (p.holdStatus === 'available' ? p.onHand : 0), 0);

      if (currentStock <= rule.minStock) {
        const deficit = rule.maxStock - currentStock;
        
        signals.push({
          rule,
          currentStock,
          status: currentStock === 0 ? 'OUT_OF_STOCK' : 'BELOW_MIN',
          suggestedQty: deficit,
          priority: rule.priority,
          sourceWarehouseId: rule.preferredSourceWarehouseId || 'WH-MAIN'
        });

        // Auto-create task if enabled
        if (rule.autoCreateTasks) {
          await this.warehouseService.createTask({
            type: WarehouseTaskType.TRANSFER,
            partNumber: rule.partNumber,
            quantity: deficit,
            fromWarehouseId: rule.preferredSourceWarehouseId || 'WH-MAIN',
            fromLocation: 'BULK', // Should be dynamic in the future
            toWarehouseId: rule.warehouseId,
            toLocation: 'RECEIVING',
            referenceType: 'REPLENISHMENT',
            referenceId: `RULE-${rule.id}`
          });
        }
      }
    }

    return signals;
  }
}
