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
import { ImprovementService } from './improvement.service';
import {
  CreateInitiativeDto,
  TransitionInitiativeDto,
  UpdateInitiativeDto,
} from './dto/improvement.dto';

/**
 * Continuous-improvement (Kaizen / Lean / 6σ) initiatives.
 * Idea capture is open to any authenticated user; admins bypass scope checks.
 */
@ApiTags('Improvement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('improvement')
export class ImprovementController {
  constructor(private readonly service: ImprovementService) {}

  @Get()
  @ApiOperation({ summary: 'Lista iniciativas de mejora (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('methodology') methodology?: string,
    @Query('area') area?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.list({ status, methodology, area, programId });
  }

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de OpEx: fases y ahorros (estimado/realizado).' })
  kpis() {
    return this.service.kpis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una iniciativa.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una iniciativa (asigna folio CI-).' })
  create(@Body() dto: CreateInitiativeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza campos de una iniciativa.' })
  update(@Param('id') id: string, @Body() dto: UpdateInitiativeDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Avanza la iniciativa por su máquina de estados.' })
  transition(@Param('id') id: string, @Body() dto: TransitionInitiativeDto) {
    return this.service.transition(id, dto);
  }
}
