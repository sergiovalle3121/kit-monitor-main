import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ProcurementService } from './procurement.service';
import {
  CreatePurchaseOrderDto,
  TransitionPurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';

@ApiTags('Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de compras: abiertas, por recibir, OTD, valor.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('orders')
  @ApiOperation({ summary: 'Lista órdenes de compra (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('supplierName') supplierName?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.list({ status, supplierName, programId });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Detalle de una orden de compra.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crea una orden de compra (folio PO-).' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(dto);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Actualiza una orden de compra.' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @Post('orders/:id/transition')
  @ApiOperation({ summary: 'Avanza la orden por su máquina de estados.' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionPurchaseOrderDto,
  ) {
    return this.service.transition(id, dto);
  }
}
