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
import { EhsService } from './ehs.service';
import {
  CreateIncidentDto,
  TransitionIncidentDto,
  UpdateIncidentDto,
} from './dto/ehs.dto';

/**
 * EHS — Safety & Environment. Anyone authenticated can report an incident or
 * near-miss (safety reporting must be frictionless); admins bypass scope.
 */
@ApiTags('EHS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ehs')
export class EhsController {
  constructor(private readonly service: EhsService) {}

  @Get('incidents')
  @ApiOperation({ summary: 'Lista incidentes EHS (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('area') area?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.list({ status, type, severity, area, programId });
  }

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs EHS: recordables, días perdidos, días sin recordable.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('incidents/:id')
  @ApiOperation({ summary: 'Detalle de un incidente.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Reporta un incidente / casi-accidente (folio INC-).' })
  create(@Body() dto: CreateIncidentDto) {
    return this.service.create(dto);
  }

  @Patch('incidents/:id')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Actualiza un incidente (causa raíz, acción, días).' })
  update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.update(id, dto);
  }

  @Post('incidents/:id/transition')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Avanza el incidente por su máquina de estados.' })
  transition(@Param('id') id: string, @Body() dto: TransitionIncidentDto) {
    return this.service.transition(id, dto);
  }
}
