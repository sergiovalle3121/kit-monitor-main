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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { OutboundService } from './outbound.service';
import {
  AssignTransportDto,
  CreateShipmentDto,
  TransitionShipmentDto,
  UpdateShipmentDto,
} from './dto/outbound.dto';

@ApiTags('Outbound')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('outbound')
export class OutboundController {
  constructor(private readonly service: OutboundService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de embarque: por embarcar, en tránsito, OTD.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('shipments')
  @ApiOperation({ summary: 'Lista embarques (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('customerName') customerName?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.list({ status, customerName, programId });
  }

  @Get('shipments/:id')
  @ApiOperation({ summary: 'Detalle de un embarque.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('shipments')
  @ApiOperation({ summary: 'Crea un embarque (folio SHP-).' })
  create(@Body() dto: CreateShipmentDto) {
    return this.service.create(dto);
  }

  @Patch('shipments/:id')
  @ApiOperation({ summary: 'Actualiza un embarque.' })
  update(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.service.update(id, dto);
  }

  @Post('shipments/:id/transition')
  @ApiOperation({ summary: 'Avanza el embarque (genera ASN al embarcar).' })
  transition(@Param('id') id: string, @Body() dto: TransitionShipmentDto) {
    return this.service.transition(id, dto);
  }

  @Post('shipments/:id/assign-transport')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Asigna transporte (transportista/unidad/chofer/andén) con poka-yoke.' })
  assignTransport(@Param('id') id: string, @Body() dto: AssignTransportDto) {
    return this.service.assignTransport(id, dto);
  }

  @Post('shipments/:id/release-transport')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Libera el transporte asignado (regresa unidad/chofer/andén a disponible).' })
  releaseTransport(@Param('id') id: string) {
    return this.service.releaseTransport(id);
  }
}
