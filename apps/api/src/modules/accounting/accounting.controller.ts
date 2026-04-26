import { Controller, Get, Query } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { Transaction } from './entities/transaction.entity';

export interface CostRollupItem {
  category: string;
  label: string;
  totalCost: number;
  percentage: number;
  items: CostBreakdownItem[];
}

export interface CostBreakdownItem {
  id: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  workOrder?: string;
  postedAt: Date;
}

export interface ProductCostRollup {
  sku: string;
  name: string;
  costs: {
    labor: number;
    materials: number;
    energy: number;
    overhead: number;
  };
  breakdown: {
    labor: CostBreakdownItem[];
    materials: CostBreakdownItem[];
    energy: CostBreakdownItem[];
    overhead: CostBreakdownItem[];
  };
  totalCost: number;
}

@Controller('api/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('transactions')
  async getTransactions(
    @Query('materialPartNumber') materialPartNumber?: string,
    @Query('workOrder') workOrder?: string,
    @Query('limit') limit?: number,
  ): Promise<Transaction[]> {
    return this.accountingService.findTransactions({
      materialPartNumber,
      workOrder,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('cost-rollup')
  async getCostRollup(
    @Query('sku') sku: string,
  ): Promise<ProductCostRollup> {
    return this.accountingService.calculateCostRollup(sku);
  }
}
