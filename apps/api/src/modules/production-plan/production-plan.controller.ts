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
import { ProductionPlanService } from './production-plan.service';
import {
  AuthorizeOperatorsDto,
  PublishWorkOrderDto,
  ResequenceDto,
  TransitionWorkOrderDto,
} from './dto/production-plan.dto';

/**
 * Plan publication wall (Block B). The planner publishes WOs that everyone on the
 * floor watches live. Publishing needs planning:publish; re-sequencing needs
 * planning:write; authorizing an operator to a WO needs production:authorize.
 */
@ApiTags('Production Plan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production-plan')
export class ProductionPlanController {
  constructor(private readonly service: ProductionPlanService) {}

  @Get()
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Feed en vivo del plan (WOs) con filtros.' })
  list(
    @Query('line') line?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
  ) {
    return this.service.list({ line, status, model });
  }

  @Get('kpis')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'KPIs: adherencia al plan, %WO con readiness, atrasos.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('crp')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary:
      'CRP: carga vs capacidad por línea (valida sobreasignación del plan).',
  })
  crp(
    @Query('availableMinutes') availableMinutes?: string,
    @Query('line') line?: string,
  ) {
    return this.service.capacityLoad({
      availableMinutes: availableMinutes ? Number(availableMinutes) : undefined,
      line,
    });
  }

  @Get(':id')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Detalle de una WO.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Get(':id/blockers')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Por qué una WO no puede correr (material, calidad, FAI).' })
  async blockers(@Param('id') id: string) {
    const wo = await this.service.getOne(id);
    return this.service.runBlockers(wo);
  }

  @Post('publish')
  @RequirePermissions('planning:publish')
  @ApiOperation({ summary: 'Publica una WO al plan (asigna folio WO-).' })
  publish(@Body() dto: PublishWorkOrderDto) {
    return this.service.publish(dto);
  }

  @Post('readiness')
  @RequirePermissions('planning:publish')
  @ApiOperation({ summary: 'Valida material readiness antes de publicar una WO.' })
  readiness(@Body() dto: PublishWorkOrderDto) {
    return this.service.evaluatePublishReadiness(dto);
  }

  @Patch(':id/resequence')
  @RequirePermissions('planning:write')
  @ApiOperation({ summary: 'Re-secuencia / re-prioriza una WO.' })
  resequence(@Param('id') id: string, @Body() dto: ResequenceDto) {
    return this.service.resequence(id, dto);
  }

  @Post(':id/transition')
  @RequirePermissions('planning:write')
  @ApiOperation({ summary: 'Avanza la WO por su máquina de estados.' })
  transition(@Param('id') id: string, @Body() dto: TransitionWorkOrderDto) {
    return this.service.transition(id, dto);
  }

  @Post(':id/authorize')
  @RequirePermissions('production:authorize')
  @ApiOperation({ summary: 'Autoriza operadores a una WO (acceso del supervisor).' })
  authorize(@Param('id') id: string, @Body() dto: AuthorizeOperatorsDto) {
    return this.service.authorizeOperators(id, dto);
  }
}
