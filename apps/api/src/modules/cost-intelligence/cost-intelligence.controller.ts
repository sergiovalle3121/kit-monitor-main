import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { CostIntelligenceService, CostingRates } from './cost-intelligence.service';
import { CreateSnapshotDto } from './dto/cost-intelligence.dto';

/**
 * Cost intelligence (Block M) — the live floor↔money bridge. COGS and material
 * variance are computed from backflush consumption, the line routing (BOM) and
 * quality holds against standard cost; period close freezes a snapshot. Reads
 * require finance:read; closing a period (write) requires finance:write.
 */
@ApiTags('Cost Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cost-intelligence')
export class CostIntelligenceController {
  constructor(private readonly service: CostIntelligenceService) {}

  private parseRates(laborRate?: string, overheadRate?: string): Partial<CostingRates> {
    const num = (v?: string) => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException('laborRate/overheadRate deben ser números ≥ 0.');
      }
      return n;
    };
    return { laborRate: num(laborRate), overheadRate: num(overheadRate) };
  }

  @Get('cogs')
  @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'COGS en vivo de una WO (material backflush + labor + overhead).' })
  cogsForWo(
    @Query('woId') woId: string,
    @Query('laborRate') laborRate?: string,
    @Query('overheadRate') overheadRate?: string,
  ) {
    if (!woId?.trim()) throw new BadRequestException('woId es requerido.');
    return this.service.cogsForWo(woId.trim(), this.parseRates(laborRate, overheadRate));
  }

  @Get('cogs/program')
  @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'COGS agregado de un programa (todas sus WOs).' })
  cogsForProgram(
    @Query('programId') programId: string,
    @Query('laborRate') laborRate?: string,
    @Query('overheadRate') overheadRate?: string,
  ) {
    if (!programId?.trim()) throw new BadRequestException('programId es requerido.');
    return this.service.cogsForProgram(
      programId.trim(),
      this.parseRates(laborRate, overheadRate),
    );
  }

  @Get('variance')
  @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'Variancia de uso de material (plan BOM×qty vs backflush) + scrap.' })
  varianceForWo(@Query('woId') woId: string) {
    if (!woId?.trim()) throw new BadRequestException('woId es requerido.');
    return this.service.varianceForWo(woId.trim());
  }

  @Get('snapshots')
  @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'Snapshots de cierre de periodo (histórico congelado).' })
  listSnapshots(
    @Query('period') period?: string,
    @Query('programId') programId?: string,
    @Query('woId') woId?: string,
  ) {
    return this.service.listSnapshots({ period, programId, woId });
  }

  @Get('snapshots/kpis')
  @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'Roll-up de periodo desde los snapshots congelados.' })
  snapshotKpis(@Query('period') period?: string, @Query('programId') programId?: string) {
    return this.service.snapshotKpis({ period, programId });
  }

  @Post('snapshots')
  @RequirePermission('finance', 'write')
  @ApiOperation({ summary: 'Cierra el periodo: congela el costeo de una WO o un programa.' })
  createSnapshot(@Body() dto: CreateSnapshotDto) {
    return this.service.createSnapshot(dto);
  }
}
