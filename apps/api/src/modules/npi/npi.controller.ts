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
import { NpiService } from './npi.service';
import { CreateNpiProjectDto, DecideGateDto } from './dto/npi.dto';

/**
 * NPI orchestration by phase gates + an ADVISORY readiness aggregator. Readiness
 * is derived live from the signals that already exist (BOM, FAI, line balance,
 * standard time, AVL) — read-only. Nothing here blocks or forces a model
 * activation; it only informs. Reads need engineering:read, writes
 * engineering:write.
 */
@ApiTags('NPI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('npi')
export class NpiController {
  constructor(private readonly service: NpiService) {}

  @Get('projects')
  @RequirePermissions('engineering:read')
  @ApiOperation({ summary: 'Lista proyectos NPI (filtros model, status).' })
  listProjects(
    @Query('model') model?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listProjects({ model, status });
  }

  @Get('readiness')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Snapshot de readiness (advisory): agrega BOM/FAI/balance/tiempo estándar/AVL por criterio.',
  })
  readiness(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.deriveReadiness(model, revision ?? '1.0');
  }

  @Get('projects/:id')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary: 'Proyecto NPI con sus gates y la readiness en vivo.',
  })
  getProject(@Param('id') id: string) {
    return this.service.getProject(id);
  }

  @Post('projects')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary: 'Crea un proyecto NPI (idempotente por model+revision).',
  })
  createProject(@Body() dto: CreateNpiProjectDto) {
    return this.service.createProject(dto);
  }

  @Post('gates/:id/decide')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary:
      'Decide un gate (PASSED/FAILED/WAIVED). Al pasar el gate MP empuja un aviso al buzón.',
  })
  decideGate(@Param('id') id: string, @Body() dto: DecideGateDto) {
    return this.service.decideGate(id, dto);
  }
}
