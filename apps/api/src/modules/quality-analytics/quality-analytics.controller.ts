import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QualityAnalyticsService } from './quality-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

/**
 * Tablero analítico de calidad: cruza NCR + IQC + final + CAPA + pruebas en una
 * sola respuesta. Solo lectura y solo requiere sesión (mismo guardrail que el
 * resto de GET de calidad: cualquier usuario autenticado lo ve).
 */
@ApiTags('Quality · Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quality/analytics')
export class QualityAnalyticsController {
  constructor(private readonly service: QualityAnalyticsService) {}

  @Get('command-center')
  @ApiOperation({
    summary:
      'Command Center de calidad: analítica + lanes operativos + atención + contención/MRB. Filtros: days, model, line, supplier.',
  })
  commandCenter(
    @Query('days') days?: string,
    @Query('model') model?: string,
    @Query('line') line?: string,
    @Query('supplier') supplier?: string,
  ) {
    return this.service.commandCenter({ days, model, line, supplier });
  }

  @Get()
  @ApiOperation({
    summary:
      'Resumen analítico de calidad (Pareto, PPM, FPY, estado de CAPAs). Filtros: days, model, line, supplier.',
  })
  summary(
    @Query('days') days?: string,
    @Query('model') model?: string,
    @Query('line') line?: string,
    @Query('supplier') supplier?: string,
  ) {
    return this.service.summary({ days, model, line, supplier });
  }
}
