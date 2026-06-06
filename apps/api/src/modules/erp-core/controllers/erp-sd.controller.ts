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
import { ErpSdService } from '../services/erp-sd.service';
import { ErpCustomer } from '../entities/erp-customer.entity';
import type { CreateSoLine } from '../services/erp-sd.service';

type AuthRequest = { user?: { email?: string } };
const actor = (req: AuthRequest) => req?.user?.email ?? 'system';

@ApiTags('ERP · Ventas (SD)')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('erp/sd')
export class ErpSdController {
  constructor(private readonly sd: ErpSdService) {}

  // Customers (XD01)
  @Get('customers')
  @RequirePermissions('sales:read')
  customers() {
    return this.sd.listCustomers();
  }
  @Get('customers/:code')
  @RequirePermissions('sales:read')
  customer(@Param('code') code: string) {
    return this.sd.getCustomer(code);
  }
  @Post('customers')
  @RequirePermissions('sales:write')
  upsertCustomer(@Body() dto: Partial<ErpCustomer>) {
    return this.sd.upsertCustomer(dto);
  }

  // Sales orders (VA01)
  @Get('sales-orders')
  @RequirePermissions('sales:read')
  salesOrders(
    @Query('status') status?: string,
    @Query('customerCode') customerCode?: string,
  ) {
    return this.sd.listSOs({ status, customerCode });
  }
  @Get('sales-orders/:id')
  @RequirePermissions('sales:read')
  salesOrder(@Param('id', ParseIntPipe) id: number) {
    return this.sd.getSO(id);
  }
  @Post('sales-orders')
  @RequirePermissions('sales:write')
  createSO(
    @Body()
    dto: {
      customerCode: string;
      requestedDate?: string;
      currency?: string;
      notes?: string;
      lines: CreateSoLine[];
    },
    @Request() req: AuthRequest,
  ) {
    return this.sd.createSO(dto, actor(req));
  }
  @Post('sales-orders/:id/confirm')
  @RequirePermissions('sales:write')
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.sd.confirmSO(id);
  }
  @Post('sales-orders/:id/cancel')
  @RequirePermissions('sales:write')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.sd.cancelSO(id);
  }
  @Post('sales-orders/:id/ship')
  @RequirePermissions('sales:write')
  ship(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { lines?: { lineNo: number; qty: number }[] },
    @Request() req: AuthRequest,
  ) {
    return this.sd.shipSO(id, dto, actor(req));
  }
  @Post('sales-orders/:id/invoice')
  @RequirePermissions('sales:write')
  invoice(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.sd.invoiceSO(id, actor(req));
  }
}
