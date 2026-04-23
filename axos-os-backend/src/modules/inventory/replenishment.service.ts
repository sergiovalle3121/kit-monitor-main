import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ReplenishmentRule } from './entities/replenishment-rule.entity';
import { InventoryPosition } from './entities/inventory-position.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseTaskType } from './entities/warehouse-task.entity';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';

@Injectable()
export class ReplenishmentService {
  constructor(
    @InjectRepository(ReplenishmentRule)
    private readonly ruleRepo: Repository<ReplenishmentRule>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    private readonly warehouseService: WarehouseService,
    private readonly audit: AuditService,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
  ) {}

  async getRules(user: User): Promise<ReplenishmentRule[]> {
    const qb = this.ruleRepo.createQueryBuilder('rule');
    
    // 1. Scope-aware filtering
    if (user.scopes?.buildings?.length > 0) {
      qb.andWhere('rule.warehouseId IN (SELECT id FROM enterprise_warehouses WHERE building_id IN (:...bids))', { bids: user.scopes.buildings });
    }

    return qb.getMany();
  }

  async createRule(dto: Partial<ReplenishmentRule>, user: User): Promise<ReplenishmentRule> {
    const rule = this.ruleRepo.create(dto);
    const saved = await this.ruleRepo.save(rule);

    await this.audit.recordAction({
      actor: user.email,
      action: 'REPLENISHMENT_RULE_CREATED',
      resourceType: 'ReplenishmentRule',
      resourceId: saved.id.toString(),
      metadata: { partNumber: saved.partNumber, warehouse: saved.warehouseId },
      outcome: 'ALLOWED'
    });

    return saved;
  }

  async analyzeInventory(user: User): Promise<any[]> {
    const qb = this.ruleRepo.createQueryBuilder('rule')
      .where('rule.isActive = :active', { active: true });

    // 1. Scope-aware filtering
    if (user.scopes?.buildings?.length > 0) {
      qb.andWhere('rule.warehouseId IN (SELECT id FROM enterprise_warehouses WHERE building_id IN (:...bids))', { bids: user.scopes.buildings });
    }

    const rules = await qb.getMany();
    const signals: any[] = [];

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
          }, user);
        }
      }
    }

    return signals;
  }
}
