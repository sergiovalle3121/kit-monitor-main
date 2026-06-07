import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { MaterialStagingService } from './material-staging.service';
import {
  ConfirmStagedDto,
  GenerateStagingDto,
  RaiseReplenishDto,
  ShortageDto,
} from './dto/material-staging.dto';
import { ReplenishStatus } from './staging-status';

/**
 * Material staging + e-kanban (Block C). The materialist stages kits to stations
 * and the warehouse works replenishment calls. Reads need materials:read;
 * staging/confirm/shortage need materials:stage; raising a call needs
 * materials:request.
 */
@ApiTags('Material Staging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material-staging')
export class MaterialStagingController {
  constructor(private readonly service: MaterialStagingService) {}

  @Post('generate')
  @RequirePermissions('materials:stage')
  @ApiOperation({ summary: 'Genera las líneas de surtido de una WO desde su ruteo.' })
  generate(@Body() dto: GenerateStagingDto) {
    return this.service.generateForWorkOrder(dto);
  }

  @Get()
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Cola de surtido (todas las líneas) con filtro de estado.' })
  list(@Query('status') status?: string) {
    return this.service.listStaging({ status });
  }

  @Get('kpis')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'KPIs: fill-rate, faltantes, llamados abiertos, tiempo de reposición.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('replenish')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Tablero de llamados de reposición (e-kanban).' })
  replenish(@Query('status') status?: string) {
    return this.service.listReplenishCalls({ status });
  }

  @Get('wo/:woId')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Estado de material por estación para una WO.' })
  forWo(@Param('woId') woId: string) {
    return this.service.listForWorkOrder(woId);
  }

  @Post(':id/confirm')
  @RequirePermissions('materials:stage')
  @ApiOperation({ summary: 'Confirma material montado en una estación.' })
  confirm(@Param('id') id: string, @Body() dto: ConfirmStagedDto) {
    return this.service.confirmStaged(id, dto);
  }

  @Post(':id/shortage')
  @RequirePermissions('materials:stage')
  @ApiOperation({ summary: 'Marca faltante (alerta + bloquea readiness + llamado).' })
  shortage(@Param('id') id: string, @Body() dto: ShortageDto) {
    return this.service.markShortage(id, dto);
  }

  @Post('replenish')
  @RequirePermissions('materials:request')
  @ApiOperation({ summary: 'Levanta un llamado de reposición manual.' })
  raise(@Body() dto: RaiseReplenishDto) {
    return this.service.raiseReplenish(dto);
  }

  @Post('replenish/:id/transition')
  @RequirePermissions('materials:stage')
  @ApiOperation({ summary: 'Avanza un llamado (en tránsito / entregado).' })
  transitionCall(@Param('id') id: string, @Body() body: { status: ReplenishStatus }) {
    return this.service.transitionReplenish(id, body.status);
  }
}
