import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RoutingBackflushService } from './routing-backflush.service';
import { CommitBackflushDto, PreviewBackflushDto } from './dto/backflush.dto';

/**
 * Routing-driven backflush. Given units produced at a routing operation, consume
 * the materials assigned to that operation (`rt_operation_material` × units) from
 * inventory — the BOM↔routing bridge made operational. Preview (read-only) +
 * explicit commit (posts CONSUME via the existing inventory service; per-line
 * error report, never silent). Additive: does not modify the operator terminal.
 */
@ApiTags('Backflush por Ruteo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('routing-backflush')
export class RoutingBackflushController {
  constructor(private readonly service: RoutingBackflushService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Calcula el consumo por operación (sin escribir).' })
  preview(@Body() dto: PreviewBackflushDto) {
    return this.service.preview(dto);
  }

  @Post('commit')
  @ApiOperation({ summary: 'Postea el consumo a inventario (CONSUME), reporta por línea.' })
  commit(@Body() dto: CommitBackflushDto) {
    return this.service.commit(dto);
  }
}
