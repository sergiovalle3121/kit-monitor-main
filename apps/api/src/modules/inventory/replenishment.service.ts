import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReplenishmentRule } from './entities/replenishment-rule.entity';
import { InventoryPosition } from './entities/inventory-position.entity';
import { WarehouseService } from './warehouse.service';
import { WarehouseTaskType } from './entities/warehouse-task.entity';
import { AuditService } from '../governance/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class ReplenishmentService {
  constructor(
    @InjectRepository(ReplenishmentRule)
    private readonly ruleRepo: Repository<ReplenishmentRule>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    private readonly warehouseService: WarehouseService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getRules(): Promise<ReplenishmentRule[]> {
    const qb = this.ruleRepo.createQueryBuilder('rule');

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('rule.tenant_id = :tenantId', { tenantId });

    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      qb.andWhere(
        'rule.warehouseId IN (SELECT id FROM enterprise_warehouses WHERE building_id IN (:...bids))',
        { bids: allowedBuildings },
      );
    }

    return qb.orderBy('rule.warehouseId', 'ASC').getMany();
  }

  async createRule(dto: Partial<ReplenishmentRule>): Promise<ReplenishmentRule> {
    const rule = this.ruleRepo.create({
      ...dto,
      tenant_id: this.tenantContext.getTenantId(),
      organization_id: this.tenantContext.getOrganizationId(),
      plant_id: this.tenantContext.getPlantId(),
    });
    const saved = await this.ruleRepo.save(rule);

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'REPLENISHMENT_RULE_CREATED',
      resourceType: 'ReplenishmentRule',
      resourceId: saved.id.toString(),
      metadata: { partNumber: saved.partNumber, warehouse: saved.warehouseId },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  async analyzeInventory(): Promise<AnalysisSignal[]> {
    const qb = this.ruleRepo
      .createQueryBuilder('rule')
      .where('rule.isActive = :active', { active: true });

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('rule.tenant_id = :tenantId', { tenantId });

    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      qb.andWhere(
        'rule.warehouseId IN (SELECT id FROM enterprise_warehouses WHERE building_id IN (:...bids))',
        { bids: allowedBuildings },
      );
    }

    const rules = await qb.getMany();
    const signals: AnalysisSignal[] = [];

    for (const rule of rules) {
      const positions = await this.positionRepo.find({
        where: {
          warehouseId: rule.warehouseId,
          partNumber: rule.partNumber,
          programId: rule.programId,
        },
      });

      const currentStock = positions.reduce(
        (acc, p) => acc + (p.holdStatus === 'available' ? p.onHand : 0),
        0,
      );

      if (currentStock <= rule.minStock) {
        const deficit = rule.maxStock - currentStock;

        signals.push({
          rule,
          currentStock,
          status: currentStock === 0 ? 'OUT_OF_STOCK' : 'BELOW_MIN',
          suggestedQty: deficit,
          priority: rule.priority,
          sourceWarehouseId: rule.preferredSourceWarehouseId ?? 'WH-MAIN',
        });

        if (rule.autoCreateTasks) {
          await this.warehouseService.createTask({
            type: WarehouseTaskType.TRANSFER,
            partNumber: rule.partNumber,
            quantity: deficit,
            fromWarehouseId: rule.preferredSourceWarehouseId ?? 'WH-MAIN',
            fromLocation: 'BULK',
            toWarehouseId: rule.warehouseId,
            toLocation: 'RECEIVING',
            referenceType: 'REPLENISHMENT',
            referenceId: `RULE-${rule.id}`,
          });
        }
      }
    }

    return signals;
  }
}

export interface AnalysisSignal {
  rule: ReplenishmentRule;
  currentStock: number;
  status: 'OUT_OF_STOCK' | 'BELOW_MIN';
  suggestedQty: number;
  priority: string;
  sourceWarehouseId: string;
}
