import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { MaterialStagingMesService } from './material-staging-mes.service';
import { StagePlanLineDto } from './dto/material-staging-mes.dto';

/**
 * Carril 1 (puente MES) del kitteador. Surte los PLANES publicados (plans →
 * pick-list por planId) SIN tocar el carril 2 (sf_staging / sf_work_orders).
 * Rutas namespaced bajo `material-staging/mes`; los permisos son los mismos del
 * carril 2 (materials:read / materials:stage). Capa desechable: jubilar el puente
 * (Forma 2) = borrar este controlador + su módulo.
 */
@ApiTags('Material Staging (Carril 1 · MES)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material-staging/mes')
export class MaterialStagingMesController {
  constructor(private readonly service: MaterialStagingMesService) {}

  @Get('plans')
  @RequirePermissions('materials:read')
  @ApiOperation({
    summary: 'Planes publicados (carril 1) como cola de surtido del kitteador.',
  })
  listPlans(@Query('status') status?: string) {
    return this.service.listPublishedPlans({ status });
  }

  @Get('plans/:planId')
  @RequirePermissions('materials:read')
  @ApiOperation({
    summary:
      'Pick-list de un plan (PickListService.getByPlan) + estado de surtido carril 1.',
  })
  getPlan(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.getPlanPickList(planId);
  }

  @Post('plans/:planId/stage-all')
  @RequirePermissions('materials:stage')
  @ApiOperation({
    summary: 'Marca TODO el pick-list del plan como surtido (staged).',
  })
  stageAll(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.stageAllForPlan(planId);
  }

  @Post('plans/:planId/lines/:kitMaterialId/stage')
  @RequirePermissions('materials:stage')
  @ApiOperation({
    summary: 'Marca una línea del pick-list como surtida (staged).',
  })
  stageLine(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('kitMaterialId', ParseIntPipe) kitMaterialId: number,
    @Body() dto: StagePlanLineDto,
  ) {
    return this.service.stageLine(planId, kitMaterialId, dto);
  }

  @Post('plans/:planId/lines/:kitMaterialId/unstage')
  @RequirePermissions('materials:stage')
  @ApiOperation({
    summary: 'Revierte el surtido de una línea (vuelve a pendiente).',
  })
  unstageLine(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('kitMaterialId', ParseIntPipe) kitMaterialId: number,
  ) {
    return this.service.unstageLine(planId, kitMaterialId);
  }
}
