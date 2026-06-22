import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LineEngineeringService } from './line-engineering.service';
import { StationStatusService } from './station-status.service';
import {
  CloneLayoutDto,
  CreateStationDto,
  QualifyModelLineDto,
  SaveLayoutDto,
  UpdateModelLineDto,
  UpdateStationDto,
  UploadDxfDto,
} from './dto/line-engineering.dto';

/**
 * Industrial Engineering — line disposition: station layout, model↔line
 * qualification, routing, line balancing and load. Reads need engineering:read;
 * mutations need engineering:write.
 */
@ApiTags('Line Engineering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('line-engineering')
export class LineEngineeringController {
  constructor(
    private readonly service: LineEngineeringService,
    private readonly statusService: StationStatusService,
  ) {}

  @Get('stations')
  @RequirePermissions('engineering:read')
  @ApiOperation({ summary: 'Lista estaciones (layout) con filtros.' })
  listStations(
    @Query('model') model?: string,
    @Query('line') line?: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.listStations({ model, line, revision });
  }

  @Get('routing')
  @RequirePermissions('engineering:read')
  @ApiOperation({ summary: 'Ruteo ordenado de un modelo+revisión.' })
  routing(@Query('model') model: string, @Query('revision') revision?: string) {
    return this.service.routing(model, revision ?? 'A');
  }

  @Get('requirements')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Requerimientos por estación (NP, factor de uso) — puente a surtido/operador.',
  })
  requirements(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.stationRequirements(model, revision ?? 'A');
  }

  @Get('qualifications')
  @RequirePermissions('engineering:read')
  @ApiOperation({ summary: 'Matriz modelo↔línea (calificaciones).' })
  qualifications(@Query('line') line?: string, @Query('model') model?: string) {
    return this.service.listQualifications({ line, model });
  }

  @Get('balance')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary: 'Balanceo de línea (takt vs cycle, cuello de botella).',
  })
  balance(
    @Query('model') model: string,
    @Query('revision') revision?: string,
    @Query('availableTimeSec') availableTimeSec?: string,
    @Query('demandUnits') demandUnits?: string,
    @Query('taktTargetSec') taktTargetSec?: string,
  ) {
    return this.service.balance({
      model,
      revision: revision ?? 'A',
      availableTimeSec: availableTimeSec ? Number(availableTimeSec) : undefined,
      demandUnits: demandUnits ? Number(demandUnits) : undefined,
      taktTargetSec: taktTargetSec ? Number(taktTargetSec) : undefined,
    });
  }

  @Get('capacity')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary: 'Capacidad/carga de línea (requerido vs disponible).',
  })
  capacity(
    @Query('model') model: string,
    @Query('line') line: string,
    @Query('availableMinutes') availableMinutes: string,
    @Query('demandUnits') demandUnits: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.capacity({
      model,
      line,
      revision: revision ?? 'A',
      availableMinutes: Number(availableMinutes) || 0,
      demandUnits: Number(demandUnits) || 0,
    });
  }

  @Get('kpis')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'KPIs de IE: %ayuda visual, %modelos balanceados, layouts incompletos.',
  })
  kpis() {
    return this.service.kpis();
  }

  @Get('layout')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Layout 2D de un modelo+revisión: footprint + estaciones (posición o sin colocar).',
  })
  getLayout(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.getLayout(model, revision ?? 'A');
  }

  @Put('layout')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary:
      'Guarda el layout 2D (footprint + posiciones x/y/w/h/rotación por estación). Aditivo.',
  })
  saveLayout(@Body() dto: SaveLayoutDto) {
    return this.service.saveLayout(dto);
  }

  @Post('layout/clone')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary:
      'Clona el layout (footprint/DXF/equipos/notas + posiciones por nombre) a otro modelo+revisión.',
  })
  cloneLayout(@Body() dto: CloneLayoutDto) {
    return this.service.cloneLayout(dto);
  }

  @Get('layout/dxf')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary: 'Plano DXF de fondo (nombre + contenido) de un modelo+revisión.',
  })
  getDxf(@Query('model') model: string, @Query('revision') revision?: string) {
    return this.service.getDxf(model, revision ?? 'A');
  }

  @Put('layout/dxf')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary:
      'Carga/reemplaza el plano DXF de fondo (solo lectura sobre el plano).',
  })
  setDxf(@Body() dto: UploadDxfDto) {
    return this.service.setDxf(dto);
  }

  @Delete('layout/dxf')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Quita el plano DXF de fondo del layout.' })
  clearDxf(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.clearDxf(model, revision ?? 'A');
  }

  @Get('layout/status')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Estado MES en vivo por estación (verde/ámbar/rojo) para el overlay del layout.',
  })
  layoutStatus(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.statusService.getStatus(model, revision ?? 'A');
  }

  @Get('layout/heatmap')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Mapa de calor por estación (tiempo de ciclo / utilización vs takt) para el overlay del layout.',
  })
  layoutHeatmap(
    @Query('model') model: string,
    @Query('revision') revision?: string,
    @Query('availableTimeSec') availableTimeSec?: string,
    @Query('demandUnits') demandUnits?: string,
    @Query('taktTargetSec') taktTargetSec?: string,
  ) {
    return this.service.getHeatmap({
      model,
      revision: revision ?? 'A',
      availableTimeSec: availableTimeSec ? Number(availableTimeSec) : undefined,
      demandUnits: demandUnits ? Number(demandUnits) : undefined,
      taktTargetSec: taktTargetSec ? Number(taktTargetSec) : undefined,
    });
  }

  @Get('stations/:id')
  @RequirePermissions('engineering:read')
  @ApiOperation({ summary: 'Detalle de una estación.' })
  getStation(@Param('id') id: string) {
    return this.service.getStation(id);
  }

  @Post('stations')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary:
      'Crea una estación de layout (NP, factor de uso, tiempo, ayuda visual, CTQ).',
  })
  createStation(@Body() dto: CreateStationDto) {
    return this.service.createStation(dto);
  }

  @Patch('stations/:id')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Actualiza una estación de layout.' })
  updateStation(@Param('id') id: string, @Body() dto: UpdateStationDto) {
    return this.service.updateStation(id, dto);
  }

  @Post('qualifications')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary: 'Califica un modelo en una línea (changeover, takt target).',
  })
  qualify(@Body() dto: QualifyModelLineDto) {
    return this.service.qualify(dto);
  }

  @Patch('qualifications/:id')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Actualiza una calificación modelo↔línea.' })
  updateQualification(
    @Param('id') id: string,
    @Body() dto: UpdateModelLineDto,
  ) {
    return this.service.updateQualification(id, dto);
  }
}
