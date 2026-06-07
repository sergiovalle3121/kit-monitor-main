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
import { OperatorTerminalService } from './operator-terminal.service';
import {
  ConfirmProductionDto,
  RaiseAndonDto,
  ReportDefectDto,
} from './dto/operator-terminal.dto';

/**
 * Operator terminal (Block D) — the heart of the floor. The work context, scan
 * verification and confirmation need production:execute; reporting a defect needs
 * quality:report. Confirmation enforces skill, poka-yoke, holds and shortages.
 */
@ApiTags('Operator Terminal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('operator-terminal')
export class OperatorTerminalController {
  constructor(private readonly service: OperatorTerminalService) {}

  @Get('context')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Contexto de trabajo de una estación (qué montar, material, bloqueos).' })
  context(
    @Query('woId') woId: string,
    @Query('station') station: string,
    @Query('operator') operator?: string,
  ) {
    return this.service.workContext(woId, station, operator);
  }

  @Get('verify')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Poka-yoke: ¿el NP escaneado coincide con el esperado?' })
  verify(
    @Query('woId') woId: string,
    @Query('station') station: string,
    @Query('part') part: string,
  ) {
    return this.service.verifyScan(woId, station, part);
  }

  @Get('hour-by-hour/:woId')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Hora por hora del operador (real vs plan).' })
  hourByHour(@Param('woId') woId: string) {
    return this.service.hourByHour(woId);
  }

  @Get('kpis')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'KPIs del operador/línea (u/h, andons, defectos).' })
  kpis(@Query('line') line?: string) {
    return this.service.kpis({ line });
  }

  @Get('floor-events')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Eventos de piso (andon / defecto / paro).' })
  floorEvents(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('line') line?: string,
  ) {
    return this.service.listFloorEvents({ status, type, line });
  }

  @Post('confirm')
  @RequirePermissions('production:execute')
  @ApiOperation({ summary: 'Confirma producción (skill + poka-yoke + backflush + serial, idempotente).' })
  confirm(@Body() dto: ConfirmProductionDto) {
    return this.service.confirm(dto);
  }

  @Post('andon')
  @RequirePermissions('production:execute')
  @ApiOperation({ summary: 'Dispara un andon (material/calidad/máquina/ayuda/seguridad).' })
  andon(@Body() dto: RaiseAndonDto) {
    return this.service.raiseAndon(dto);
  }

  @Post('defect')
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Reporta un defecto desde la estación.' })
  defect(@Body() dto: ReportDefectDto) {
    return this.service.reportDefect(dto);
  }

  @Post('floor-events/:id/ack')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Reconoce (atiende) un evento de piso.' })
  ack(@Param('id') id: string) {
    return this.service.ackFloorEvent(id);
  }

  @Post('floor-events/:id/resolve')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Resuelve un evento de piso (captura downtime).' })
  resolve(@Param('id') id: string, @Body() body: { downtimeMinutes?: number; downtimeCode?: string }) {
    return this.service.resolveFloorEvent(id, body.downtimeMinutes, body.downtimeCode);
  }
}
