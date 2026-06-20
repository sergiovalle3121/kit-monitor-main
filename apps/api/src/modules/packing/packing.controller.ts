import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { PackingService } from './packing.service';
import { CreateHandlingUnitDto, UpdateHandlingUnitDto } from './dto/packing.dto';

/**
 * Packing (Empaque) — handling units (pallets/cartons) with GS1 SSCC + ZPL label
 * for the EMS shipping suite. Reads need `logistics:read`, mutations
 * `logistics:write`. References shipments by id (no FK).
 */
@ApiTags('Packing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('packing')
export class PackingController {
  constructor(private readonly service: PackingService) {}

  @Get('handling-units')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista unidades de manejo (filtro por embarque/estatus).' })
  list(@Query('shipmentId') shipmentId?: string, @Query('status') status?: string) {
    return this.service.list({ shipmentId, status });
  }

  @Get('handling-units/:id')
  @RequirePermissions('logistics:read')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('handling-units')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Crea una unidad de manejo (genera SSCC).' })
  create(@Body() dto: CreateHandlingUnitDto) {
    return this.service.create(dto);
  }

  @Patch('handling-units/:id')
  @RequirePermissions('logistics:write')
  update(@Param('id') id: string, @Body() dto: UpdateHandlingUnitDto) {
    return this.service.update(id, dto);
  }

  @Delete('handling-units/:id')
  @RequirePermissions('logistics:write')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('handling-units/:id/regenerate-sscc')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Reasigna un nuevo SSCC a la unidad.' })
  regenerate(@Param('id') id: string) {
    return this.service.regenerateSscc(id);
  }

  @Get('handling-units/:id/label')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Devuelve la etiqueta GS1-128 (SSCC) en ZPL (Zebra) + JSON.' })
  label(@Param('id') id: string) {
    return this.service.label(id);
  }

  // ── Carga verificada por escaneo (SSCC ↔ embarque) ─────────────────────────

  @Get('loading/:shipmentId')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Checklist de carga del embarque: unidades esperadas + cargadas/pendientes.' })
  loadingState(@Param('shipmentId') shipmentId: string) {
    return this.service.loadingState(shipmentId);
  }

  @Post('loading/:shipmentId/scan')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Verifica un SSCC contra el embarque y lo marca cargado (poka-yoke).' })
  scan(@Param('shipmentId') shipmentId: string, @Body('sscc') sscc: string) {
    return this.service.verifyScan(shipmentId, sscc);
  }

  @Post('loading/:shipmentId/reset')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Revierte una unidad cargada a empacada (corrección del operador).' })
  resetScan(
    @Param('shipmentId') shipmentId: string,
    @Body('handlingUnitId') handlingUnitId: string,
  ) {
    return this.service.resetScan(shipmentId, handlingUnitId);
  }

  @Get('handling-units/:id/label.zpl')
  @RequirePermissions('logistics:read')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Etiqueta cruda en ZPL para enviar a la impresora Zebra.' })
  async labelRaw(@Param('id') id: string): Promise<string> {
    return (await this.service.label(id)).zpl;
  }
}
