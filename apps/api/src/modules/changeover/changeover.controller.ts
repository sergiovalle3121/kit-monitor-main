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
import { ChangeoverService } from './changeover.service';
import {
  ChangeoverQueryDto,
  ChecklistToggleDto,
  CompleteChangeoverDto,
  OpenChangeoverDto,
} from './dto/changeover.dto';

/**
 * Changeover / SMED (model-to-model setup on a line). A setup checklist + a
 * stopwatch measuring the changeover time, which is recorded as downtime of
 * category 'changeover' (B1 OEE contract). Writes need production:write; reads
 * need production:read.
 */
@ApiTags('Changeover / SMED')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('changeover')
export class ChangeoverController {
  constructor(private readonly service: ChangeoverService) {}

  @Get()
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Lista changeovers (filtros line, status).' })
  list(@Query() query: ChangeoverQueryDto) {
    return this.service.list(query);
  }

  @Get('kpis')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary:
      'KPIs SMED: tiempo de cambio promedio, %en objetivo, downtime de changeover.',
  })
  kpis() {
    return this.service.kpis();
  }

  @Get(':id')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Detalle de un changeover.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @RequirePermissions('production:write')
  @ApiOperation({
    summary:
      'Abre un changeover (checklist + transición de modelo en la línea).',
  })
  open(@Body() dto: OpenChangeoverDto) {
    return this.service.open(dto);
  }

  @Post(':id/start')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Arranca el cronómetro (línea abajo por cambio).' })
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Post(':id/checklist')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Marca / desmarca un paso del checklist de setup.' })
  checklist(@Param('id') id: string, @Body() dto: ChecklistToggleDto) {
    return this.service.toggleChecklist(id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Detiene el cronómetro y registra el downtime de changeover.',
  })
  complete(@Param('id') id: string, @Body() dto: CompleteChangeoverDto) {
    return this.service.complete(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Cancela el changeover.' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
