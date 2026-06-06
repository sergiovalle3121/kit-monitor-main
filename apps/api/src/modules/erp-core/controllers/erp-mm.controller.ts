import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { ErpMmService } from '../services/erp-mm.service';
import { ErpSupplierPrice } from '../entities/erp-supplier-price.entity';
import type { CreatePoLine } from '../services/erp-mm.service';
import type { CostingMethod } from '../entities/erp-material-valuation.entity';
import type { RequisitionSource } from '../entities/erp-purchase-requisition.entity';

type AuthRequest = { user?: { email?: string } };
const actor = (req: AuthRequest) => req?.user?.email ?? 'system';

@ApiTags('ERP · Materiales (MM)')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('erp/mm')
export class ErpMmController {
  constructor(private readonly mm: ErpMmService) {}

  // Valuation
  @Get('valuation')
  @RequirePermissions('materials:read')
  valuation() {
    return this.mm.inventoryValuation();
  }
  @Post('valuation/:partNumber/method')
  @RequirePermissions('materials:write')
  setMethod(
    @Param('partNumber') partNumber: string,
    @Body() dto: { method: CostingMethod },
  ) {
    return this.mm.setCostingMethod(partNumber, dto.method);
  }

  // Supplier prices / sourcing
  @Get('supplier-prices')
  @RequirePermissions('materials:read')
  supplierPrices(@Query('partNumber') partNumber?: string) {
    return this.mm.listSupplierPrices(partNumber);
  }
  @Post('supplier-prices')
  @RequirePermissions('materials:write')
  upsertPrice(@Body() dto: Partial<ErpSupplierPrice>) {
    return this.mm.upsertSupplierPrice(dto);
  }

  // Requisitions (ME51N)
  @Get('requisitions')
  @RequirePermissions('materials:read')
  requisitions(@Query('status') status?: string) {
    return this.mm.listRequisitions({ status });
  }
  @Post('requisitions')
  @RequirePermissions('materials:write')
  createRequisition(
    @Body()
    dto: {
      partNumber: string;
      quantity: number;
      needBy?: string;
      description?: string;
      source?: RequisitionSource;
      suggestedSupplierId?: number;
      notes?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.mm.createRequisition({ ...dto, createdBy: actor(req) });
  }
  @Post('requisitions/:id/convert')
  @RequirePermissions('materials:write')
  convert(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { supplierId?: number; unitPrice?: number },
    @Request() req: AuthRequest,
  ) {
    return this.mm.convertRequisitionToPO(id, dto, actor(req));
  }
  @Post('requisitions/:id/cancel')
  @RequirePermissions('materials:write')
  cancelRequisition(@Param('id', ParseIntPipe) id: number) {
    return this.mm.cancelRequisition(id);
  }

  // Purchase orders (ME21N / MM02)
  @Get('purchase-orders')
  @RequirePermissions('materials:read')
  pos(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.mm.listPOs({
      status,
      supplierId: supplierId ? Number(supplierId) : undefined,
    });
  }
  @Get('purchase-orders/:id')
  @RequirePermissions('materials:read')
  po(@Param('id', ParseIntPipe) id: number) {
    return this.mm.getPO(id);
  }
  @Post('purchase-orders')
  @RequirePermissions('materials:write')
  createPO(
    @Body()
    dto: {
      supplierId: number;
      lines: CreatePoLine[];
      currency?: string;
      warehouseId?: string;
      expectedDate?: string;
      notes?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.mm.createPO(dto, actor(req));
  }
  @Post('purchase-orders/:id/issue')
  @RequirePermissions('materials:write')
  issue(@Param('id', ParseIntPipe) id: number) {
    return this.mm.issuePO(id);
  }
  @Post('purchase-orders/:id/receive')
  @RequirePermissions('materials:write')
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { lines?: { lineNo: number; qty: number }[] },
    @Request() req: AuthRequest,
  ) {
    return this.mm.receivePO(id, dto, actor(req));
  }
  @Post('purchase-orders/:id/cancel')
  @RequirePermissions('materials:write')
  cancelPO(@Param('id', ParseIntPipe) id: number) {
    return this.mm.cancelPO(id);
  }

  // Goods issue (MM03)
  @Post('goods-issue')
  @RequirePermissions('materials:write')
  goodsIssue(
    @Body()
    dto: {
      partNumber: string;
      quantity: number;
      warehouseId?: string;
      workOrder?: string;
      reason?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.mm.issueMaterial(dto, actor(req));
  }
}
