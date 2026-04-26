import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  IndustrialAccountCode,
  Transaction,
  TransactionCostBasis,
  TransactionDirection,
  TransactionSourceType,
} from './entities/transaction.entity';
import { CostBreakdownItem, ProductCostRollup } from './accounting.controller';

type AccountRef = {
  code: IndustrialAccountCode;
  name: string;
};

type JournalLineInput = {
  direction: TransactionDirection;
  account: AccountRef;
  warehouseId?: string | null;
  location?: string | null;
};

type RecordInventoryMovementInput = {
  movement: InventoryMovement;
  material: MaterialMaster;
  manager?: EntityManager;
  sourceType?: TransactionSourceType;
  actualUnitCost?: number;
  currency?: string;
  costBasis?: TransactionCostBasis;
  metadata?: Record<string, unknown>;
};

type RecordJournalInput = {
  sourceType: TransactionSourceType;
  sourceId: string;
  referenceType?: string | null;
  referenceId?: string | null;
  materialPartNumber?: string | null;
  workOrder?: string | null;
  quantity: number;
  uom?: string;
  actualUnitCost: number;
  actualTotalCost: number;
  currency?: string;
  costBasis: TransactionCostBasis;
  actorName?: string | null;
  description?: string | null;
  lines: JournalLineInput[];
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async recordInventoryMovement(
    input: RecordInventoryMovementInput,
  ): Promise<Transaction[]> {
    const { movement, material } = input;
    const quantity = this.round(Math.abs(Number(movement.quantity ?? 0)));
    const actualUnitCost = this.round(
      input.actualUnitCost ?? material.standardCost ?? 0,
    );
    const actualTotalCost = this.round(quantity * actualUnitCost);
    const costBasis =
      input.costBasis ??
      (input.actualUnitCost !== undefined
        ? TransactionCostBasis.ACTUAL
        : actualUnitCost > 0
          ? TransactionCostBasis.MATERIAL_MASTER
          : TransactionCostBasis.ZERO_COST);

    const lines = this.buildInventoryJournalLines(movement);
    if (!lines.length) return [];

    return this.recordJournal(
      {
        sourceType:
          input.sourceType ?? TransactionSourceType.INVENTORY_MOVEMENT,
        sourceId: String(movement.id),
        referenceType: movement.referenceType ?? movement.type,
        referenceId: movement.referenceId ?? String(movement.id),
        materialPartNumber: movement.partNumber,
        workOrder:
          movement.referenceType === 'WO' ||
          movement.referenceType === 'FG_DECLARATION'
            ? movement.referenceId
            : null,
        quantity,
        uom: material.uom,
        actualUnitCost,
        actualTotalCost,
        currency: input.currency,
        costBasis,
        actorName: movement.actorName,
        description:
          movement.reason ??
          `Inventory ${movement.type} for ${movement.partNumber}`,
        lines,
        metadata: {
          inventoryMovementType: movement.type,
          fromWarehouseId: movement.fromWarehouseId ?? null,
          toWarehouseId: movement.toWarehouseId ?? null,
          costWarning:
            actualUnitCost <= 0
              ? 'No unit cost was available when this transaction posted.'
              : undefined,
          ...input.metadata,
        },
      },
      input.manager,
    );
  }

  async recordJournal(
    input: RecordJournalInput,
    manager?: EntityManager,
  ): Promise<Transaction[]> {
    if (input.lines.length < 2) {
      throw new BadRequestException(
        'Accounting journal requires at least one debit and one credit line.',
      );
    }

    const debitCount = input.lines.filter(
      (line) => line.direction === TransactionDirection.DEBIT,
    ).length;
    const creditCount = input.lines.filter(
      (line) => line.direction === TransactionDirection.CREDIT,
    ).length;

    if (!debitCount || !creditCount) {
      throw new BadRequestException(
        'Accounting journal must include both debit and credit entries.',
      );
    }

    const journalId = randomUUID();
    const repo = manager?.getRepository(Transaction) ?? this.transactionRepo;
    const tenant_id = this.tenantContext.getTenantId();
    const organization_id = this.tenantContext.getOrganizationId();
    const plant_id = this.tenantContext.getPlantId();

    const rows = input.lines.map((line, index) =>
      repo.create({
        tenant_id,
        organization_id,
        plant_id,
        journalId,
        lineNumber: index + 1,
        direction: line.direction,
        accountCode: line.account.code,
        accountName: line.account.name,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        materialPartNumber: input.materialPartNumber ?? null,
        workOrder: input.workOrder ?? null,
        warehouseId: line.warehouseId ?? null,
        location: line.location ?? null,
        quantity: this.round(input.quantity),
        uom: input.uom ?? 'EA',
        actualUnitCost: this.round(input.actualUnitCost),
        actualTotalCost: this.round(input.actualTotalCost),
        currency: input.currency ?? 'USD',
        costBasis: input.costBasis,
        actorName: input.actorName ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      }),
    );

    return repo.save(rows);
  }

  private buildInventoryJournalLines(
    movement: InventoryMovement,
  ): JournalLineInput[] {
    const lines: JournalLineInput[] = [];

    if (movement.toWarehouseId) {
      lines.push({
        direction: TransactionDirection.DEBIT,
        account: this.inventoryAccountForWarehouse(movement.toWarehouseId),
        warehouseId: movement.toWarehouseId,
        location: movement.toLocation ?? null,
      });
    } else {
      lines.push({
        direction: TransactionDirection.DEBIT,
        account: this.offsetAccountForInventoryIssue(movement.type),
      });
    }

    if (movement.fromWarehouseId) {
      lines.push({
        direction: TransactionDirection.CREDIT,
        account: this.inventoryAccountForWarehouse(movement.fromWarehouseId),
        warehouseId: movement.fromWarehouseId,
        location: movement.fromLocation ?? null,
      });
    } else {
      lines.push({
        direction: TransactionDirection.CREDIT,
        account: this.inventoryClearingAccount(),
      });
    }

    return lines;
  }

  private inventoryAccountForWarehouse(warehouseId: string): AccountRef {
    if (warehouseId.startsWith('LINE-')) {
      return {
        code: IndustrialAccountCode.WIP_INVENTORY,
        name: 'Work in Process Inventory',
      };
    }

    if (warehouseId.includes('FG')) {
      return {
        code: IndustrialAccountCode.FINISHED_GOODS_INVENTORY,
        name: 'Finished Goods Inventory',
      };
    }

    return {
      code: IndustrialAccountCode.RAW_MATERIAL_INVENTORY,
      name: 'Raw Material Inventory',
    };
  }

  private offsetAccountForInventoryIssue(type: string): AccountRef {
    if (type === 'SCRAP') {
      return {
        code: IndustrialAccountCode.SCRAP_EXPENSE,
        name: 'Scrap Expense',
      };
    }

    if (type === 'ADJUST') {
      return {
        code: IndustrialAccountCode.INVENTORY_ADJUSTMENT,
        name: 'Inventory Adjustment',
      };
    }

    return {
      code: IndustrialAccountCode.PRODUCTION_CONSUMPTION,
      name: 'Production Consumption',
    };
  }

  private inventoryClearingAccount(): AccountRef {
    return {
      code: IndustrialAccountCode.INVENTORY_CLEARING,
      name: 'Inventory Clearing',
    };
  }

  private round(value: number): number {
    return Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;
  }

  async findTransactions(filters: {
    materialPartNumber?: string | null;
    workOrder?: string | null;
    limit?: number;
  }): Promise<Transaction[]> {
    const query = this.transactionRepo.createQueryBuilder('transaction');
    
    if (filters.materialPartNumber) {
      query.andWhere('transaction.materialPartNumber = :materialPartNumber', {
        materialPartNumber: filters.materialPartNumber,
      });
    }
    
    if (filters.workOrder) {
      query.andWhere('transaction.workOrder = :workOrder', {
        workOrder: filters.workOrder,
      });
    }
    
    query.orderBy('transaction.postedAt', 'DESC').limit(filters.limit ?? 100);
    
    return query.getMany();
  }

  async calculateCostRollup(sku: string): Promise<ProductCostRollup> {
    const transactions = await this.transactionRepo.find({
      where: { materialPartNumber: sku },
      order: { postedAt: 'DESC' },
    });

    const categoryMapping: Record<string, IndustrialAccountCode[]> = {
      labor: [IndustrialAccountCode.WIP_INVENTORY],
      materials: [IndustrialAccountCode.RAW_MATERIAL_INVENTORY, IndustrialAccountCode.PRODUCTION_CONSUMPTION],
      energy: [IndustrialAccountCode.WIP_INVENTORY],
      overhead: [IndustrialAccountCode.INVENTORY_ADJUSTMENT, IndustrialAccountCode.SCRAP_EXPENSE],
    };

    const breakdown: Record<string, CostBreakdownItem[]> = {
      labor: [],
      materials: [],
      energy: [],
      overhead: [],
    };

    const costs = { labor: 0, materials: 0, energy: 0, overhead: 0 };

    for (const tx of transactions) {
      let category: string | null = null;
      
      for (const [cat, codes] of Object.entries(categoryMapping)) {
        if (codes.includes(tx.accountCode as IndustrialAccountCode)) {
          category = cat;
          break;
        }
      }

      if (!category) {
        category = 'overhead';
      }

      const item: CostBreakdownItem = {
        id: tx.id,
        name: tx.description ?? tx.accountName,
        partNumber: tx.materialPartNumber ?? undefined,
        quantity: tx.quantity,
        unitCost: tx.actualUnitCost,
        totalCost: tx.actualTotalCost,
        workOrder: tx.workOrder ?? undefined,
        postedAt: tx.postedAt,
      };

      breakdown[category].push(item);
      costs[category as keyof typeof costs] += tx.actualTotalCost;
    }

    const totalCost = Object.values(costs).reduce((sum, val) => sum + val, 0);

    return {
      sku,
      name: sku,
      costs,
      breakdown,
      totalCost,
    };
  }
}
