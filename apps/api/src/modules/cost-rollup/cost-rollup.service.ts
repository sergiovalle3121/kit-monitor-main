import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CostCategory, CostItem } from './entities/cost-item.entity';

export type CostRollupBreakdown = {
  category: CostCategory;
  amount: number;
  percentage: number;
};

export type CostRollupResponse = {
  totalCost: number;
  breakdown: CostRollupBreakdown[];
  items: CostItem[];
};

type CostRollupFilters = {
  workOrderId?: string;
};

type SeedRecord = {
  workOrderId: string;
  category: CostCategory;
  amount: number;
  description: string;
};

const CATEGORY_ORDER = [
  CostCategory.LABOR,
  CostCategory.MATERIALS,
  CostCategory.ENERGY,
  CostCategory.OVERHEAD,
];

const SEED_RECORDS: SeedRecord[] = [
  {
    workOrderId: 'WO-9012',
    category: CostCategory.LABOR,
    amount: 4820,
    description: 'Line 1 Salaries - Assembly Shift A',
  },
  {
    workOrderId: 'WO-9012',
    category: CostCategory.MATERIALS,
    amount: 12840.75,
    description: 'Epoxy Resin Lot 452',
  },
  {
    workOrderId: 'WO-9012',
    category: CostCategory.ENERGY,
    amount: 1430.5,
    description: 'Compression Oven Energy Allocation',
  },
  {
    workOrderId: 'WO-9012',
    category: CostCategory.OVERHEAD,
    amount: 3180,
    description: 'Facility Lease Allocation',
  },
  {
    workOrderId: 'WO-9031',
    category: CostCategory.LABOR,
    amount: 5360,
    description: 'Line 2 Salaries - Final Assembly',
  },
  {
    workOrderId: 'WO-9031',
    category: CostCategory.MATERIALS,
    amount: 16420.3,
    description: 'Aluminum Housing Batch A17',
  },
  {
    workOrderId: 'WO-9031',
    category: CostCategory.ENERGY,
    amount: 980.4,
    description: 'CNC Cell Energy Allocation',
  },
  {
    workOrderId: 'WO-9031',
    category: CostCategory.OVERHEAD,
    amount: 2460,
    description: 'Maintenance Shared Services',
  },
  {
    workOrderId: 'WO-9044',
    category: CostCategory.LABOR,
    amount: 3985.5,
    description: 'Quality Rework Labor - Bay 4',
  },
  {
    workOrderId: 'WO-9044',
    category: CostCategory.MATERIALS,
    amount: 7225.9,
    description: 'Fastener Kit FK-220',
  },
  {
    workOrderId: 'WO-9044',
    category: CostCategory.ENERGY,
    amount: 660,
    description: 'Thermal Chamber Run',
  },
  {
    workOrderId: 'WO-9044',
    category: CostCategory.OVERHEAD,
    amount: 1215.2,
    description: 'Quality Lab Allocation',
  },
  {
    workOrderId: 'WO-9068',
    category: CostCategory.LABOR,
    amount: 6120,
    description: 'Line 3 Salaries - Weekend Premium',
  },
  {
    workOrderId: 'WO-9068',
    category: CostCategory.MATERIALS,
    amount: 20110.4,
    description: 'Copper Coil Lot C-884',
  },
  {
    workOrderId: 'WO-9068',
    category: CostCategory.ENERGY,
    amount: 1888.25,
    description: 'High Load Welding Energy',
  },
  {
    workOrderId: 'WO-9068',
    category: CostCategory.OVERHEAD,
    amount: 3820.9,
    description: 'Supervisor and Safety Allocation',
  },
  {
    workOrderId: 'WO-9086',
    category: CostCategory.LABOR,
    amount: 4555.75,
    description: 'Line 5 Salaries - Calibration Crew',
  },
  {
    workOrderId: 'WO-9086',
    category: CostCategory.MATERIALS,
    amount: 9360.1,
    description: 'Sensor Pack SP-77',
  },
  {
    workOrderId: 'WO-9086',
    category: CostCategory.ENERGY,
    amount: 775.6,
    description: 'Test Bench Power Draw',
  },
  {
    workOrderId: 'WO-9086',
    category: CostCategory.OVERHEAD,
    amount: 1980,
    description: 'Metrology Equipment Depreciation',
  },
  {
    workOrderId: 'WO-9110',
    category: CostCategory.LABOR,
    amount: 5880,
    description: 'Robotics Cell Technician Labor',
  },
  {
    workOrderId: 'WO-9110',
    category: CostCategory.MATERIALS,
    amount: 14840,
    description: 'Precision Gear Set GS-14',
  },
  {
    workOrderId: 'WO-9110',
    category: CostCategory.ENERGY,
    amount: 1240.45,
    description: 'Robotics Cell Energy Allocation',
  },
  {
    workOrderId: 'WO-9110',
    category: CostCategory.OVERHEAD,
    amount: 3025,
    description: 'Engineering Support Allocation',
  },
  {
    workOrderId: 'WO-9136',
    category: CostCategory.LABOR,
    amount: 3420,
    description: 'Packaging Cell Labor',
  },
  {
    workOrderId: 'WO-9136',
    category: CostCategory.MATERIALS,
    amount: 5125.7,
    description: 'Protective Foam Inserts Lot PF-18',
  },
  {
    workOrderId: 'WO-9136',
    category: CostCategory.ENERGY,
    amount: 430,
    description: 'Packaging Line Energy',
  },
  {
    workOrderId: 'WO-9136',
    category: CostCategory.OVERHEAD,
    amount: 890.35,
    description: 'Warehouse Handling Allocation',
  },
  {
    workOrderId: 'WO-9152',
    category: CostCategory.MATERIALS,
    amount: 11890,
    description: 'Medical Grade Polymer Lot MGP-61',
  },
  {
    workOrderId: 'WO-9152',
    category: CostCategory.LABOR,
    amount: 4670,
    description: 'Sterile Assembly Labor',
  },
];

@Injectable()
export class CostRollupService {
  constructor(
    @InjectRepository(CostItem)
    private readonly costItemRepo: Repository<CostItem>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getRollup(filters: CostRollupFilters = {}): Promise<CostRollupResponse> {
    const tenantId = this.requireTenantId();
    const workOrderId = this.normalizeWorkOrderId(filters.workOrderId);

    const aggregationQuery = this.costItemRepo
      .createQueryBuilder('cost')
      .select('cost.category', 'category')
      .addSelect('SUM(cost.amount)', 'amount')
      .where('cost.tenantId = :tenantId', { tenantId });

    const itemsQuery = this.costItemRepo
      .createQueryBuilder('cost')
      .where('cost.tenantId = :tenantId', { tenantId })
      .orderBy('cost.recordedAt', 'DESC');

    if (workOrderId) {
      const workOrderSearch = `%${workOrderId.toLowerCase()}%`;
      aggregationQuery.andWhere('LOWER(cost.workOrderId) LIKE :workOrderSearch', {
        workOrderSearch,
      });
      itemsQuery.andWhere('LOWER(cost.workOrderId) LIKE :workOrderSearch', {
        workOrderSearch,
      });
    }

    const [rawBreakdown, items] = await Promise.all([
      aggregationQuery.groupBy('cost.category').getRawMany<{
        category: CostCategory;
        amount: string | number | null;
      }>(),
      itemsQuery.getMany(),
    ]);

    const amountsByCategory = new Map(
      rawBreakdown.map((row) => [
        row.category,
        this.roundCurrency(Number(row.amount ?? 0)),
      ]),
    );
    const totalCost = this.roundCurrency(
      Array.from(amountsByCategory.values()).reduce(
        (sum, amount) => sum + amount,
        0,
      ),
    );

    const breakdown = CATEGORY_ORDER.map((category) => {
      const amount = amountsByCategory.get(category) ?? 0;
      return {
        category,
        amount,
        percentage:
          totalCost > 0
            ? this.roundPercentage((amount / totalCost) * 100)
            : 0,
      };
    });

    return { totalCost, breakdown, items };
  }

  async seedCurrentTenant(): Promise<
    CostRollupResponse & { seededCount: number }
  > {
    const tenantId = this.requireTenantId();
    const now = Date.now();
    const rows = SEED_RECORDS.map((record, index) =>
      this.costItemRepo.create({
        ...record,
        tenantId,
        currency: 'USD',
        amount: this.roundCurrency(record.amount),
        recordedAt: new Date(now - index * 1000 * 60 * 60 * 7),
      }),
    );

    await this.costItemRepo.save(rows);
    const rollup = await this.getRollup();
    return { ...rollup, seededCount: rows.length };
  }

  private normalizeWorkOrderId(workOrderId?: string): string | undefined {
    const value = workOrderId?.trim();
    return value ? value : undefined;
  }

  private requireTenantId(): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException(
        'Tenant context is required to calculate cost rollup.',
      );
    }

    return tenantId;
  }

  private roundCurrency(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private roundPercentage(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
