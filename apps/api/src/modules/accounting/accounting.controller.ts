import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
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

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('transactions')
  @RequirePermission('finance', 'read')
  async getTransactions(
    @Query('materialPartNumber') materialPartNumber?: string,
    @Query('workOrder') workOrder?: string,
    @Query('limit') limit?: string,
  ): Promise<Transaction[]> {
    return this.accountingService.findTransactions({
      materialPartNumber,
      workOrder,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('cost-rollup')
  @RequirePermission('finance', 'read')
  async getCostRollup(
    @Query('sku') sku: string,
  ): Promise<ProductCostRollup> {
    return this.accountingService.calculateCostRollup(sku);
  }
}
