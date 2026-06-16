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
import { OeeService } from './oee.service';
import {
  CloseDowntimeDto,
  OpenDowntimeDto,
  SetHxhTargetDto,
} from './dto/oee.dto';

/**
 * OEE / shop-floor metrics (Block H) — the metric the plant manager lives by.
 * Reporting reads need `production:report`; mutating the floor truth (open/close
 * downtime, set hour-by-hour targets) needs `production:write`. The REAL output
 * is always derived from the existing consumption (advance) events — never
 * re-counted here.
 */
@ApiTags('OEE')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('oee')
export class OeeController {
  constructor(private readonly service: OeeService) {}

  // ── Downtime ─────────────────────────────────────────────────────────────────
  @Get('downtime')
  @RequirePermissions('production:report')
  @ApiOperation({ summary: 'Lista paros (filtros line, status, reasonCode).' })
  listDowntime(
    @Query('line') line?: string,
    @Query('status') status?: string,
    @Query('reasonCode') reasonCode?: string,
  ) {
    return this.service.listDowntime({ line, status, reasonCode });
  }

  @Post('downtime/open')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Abre un paro con razón categorizada (línea/estación/WO).',
  })
  openDowntime(@Body() dto: OpenDowntimeDto) {
    return this.service.openDowntime(dto);
  }

  @Post('downtime/:id/close')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Cierra un paro (calcula la duración; permite recategorizar).',
  })
  closeDowntime(@Param('id') id: string, @Body() dto: CloseDowntimeDto) {
    return this.service.closeDowntime(id, dto);
  }

  // ── Hour-by-hour ──────────────────────────────────────────────────────────────
  @Get('hxh')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary:
      'Meta vs real por hora (real derivado de avance) + razón del miss.',
  })
  hourByHour(
    @Query('line') line: string,
    @Query('date') date?: string,
    @Query('shift') shift?: string,
  ) {
    return this.service.hourByHour(line, { date, shift });
  }

  @Get('hxh/targets')
  @RequirePermissions('production:report')
  @ApiOperation({ summary: 'Lista las metas hora-por-hora (line, shift).' })
  listTargets(@Query('line') line?: string, @Query('shift') shift?: string) {
    return this.service.listTargets({ line, shift });
  }

  @Post('hxh/targets')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Fija/actualiza la meta de una hora (línea/turno/hora → meta).',
  })
  setTarget(@Body() dto: SetHxhTargetDto) {
    return this.service.setTarget(dto);
  }

  // ── OEE ──────────────────────────────────────────────────────────────────────
  @Get('line')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary: 'OEE (Disp×Rend×Calidad) por línea en una ventana.',
  })
  oeeForLine(
    @Query('line') line: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shift') shift?: string,
    @Query('plannedMinutes') plannedMinutes?: string,
  ) {
    return this.service.oeeForLine(line, {
      from,
      to,
      shift,
      plannedMinutes: numOrUndef(plannedMinutes),
    });
  }

  @Get('work-order/:woId')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary: 'OEE por WO (ciclo ideal de la WO + avance + holds).',
  })
  oeeForWorkOrder(
    @Param('woId') woId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plannedMinutes') plannedMinutes?: string,
  ) {
    return this.service.oeeForWorkOrder(woId, {
      from,
      to,
      plannedMinutes: numOrUndef(plannedMinutes),
    });
  }

  // ── Control Tower feed ────────────────────────────────────────────────────────
  @Get('control-tower')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary: 'Agregador de OEE/output por línea para la Torre de Control.',
  })
  controlTower(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plannedMinutes') plannedMinutes?: string,
  ) {
    return this.service.controlTowerFeed({
      from,
      to,
      plannedMinutes: numOrUndef(plannedMinutes),
    });
  }
}

function numOrUndef(v?: string): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
