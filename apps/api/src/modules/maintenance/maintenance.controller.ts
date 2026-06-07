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
import { MaintenanceService } from './maintenance.service';
import {
  CreateAssetDto,
  CreateMaintenanceOrderDto,
  TransitionMaintenanceOrderDto,
  UpdateAssetDto,
  UpdateMaintenanceOrderDto,
} from './dto/maintenance.dto';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs CMMS: órdenes abiertas/vencidas, %PM, MTTR.' })
  kpis() {
    return this.service.kpis();
  }

  // ── Assets ──
  @Get('assets')
  @ApiOperation({ summary: 'Lista de activos / equipos.' })
  listAssets() {
    return this.service.listAssets();
  }

  @Post('assets')
  @ApiOperation({ summary: 'Da de alta un activo.' })
  createAsset(@Body() dto: CreateAssetDto) {
    return this.service.createAsset(dto);
  }

  @Patch('assets/:id')
  @ApiOperation({ summary: 'Actualiza un activo (estado, criticidad…).' })
  updateAsset(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.service.updateAsset(id, dto);
  }

  // ── Orders ──
  @Get('orders')
  @ApiOperation({ summary: 'Lista órdenes de mantenimiento (con filtros).' })
  listOrders(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('assetId') assetId?: string,
  ) {
    return this.service.listOrders({ status, type, assetId });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Detalle de una orden.' })
  getOrder(@Param('id') id: string) {
    return this.service.getOrder(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crea una orden de mantenimiento (folio MO-).' })
  createOrder(@Body() dto: CreateMaintenanceOrderDto) {
    return this.service.createOrder(dto);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Actualiza una orden.' })
  updateOrder(@Param('id') id: string, @Body() dto: UpdateMaintenanceOrderDto) {
    return this.service.updateOrder(id, dto);
  }

  @Post('orders/:id/transition')
  @ApiOperation({ summary: 'Avanza la orden por su máquina de estados.' })
  transitionOrder(
    @Param('id') id: string,
    @Body() dto: TransitionMaintenanceOrderDto,
  ) {
    return this.service.transitionOrder(id, dto);
  }
}
