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
import { StationBayService } from './station-bay.service';
import {
  CloneLayoutDto,
  CreateSnapshotDto,
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
    private readonly bayService: StationBayService,
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

  @Get('layout/bays')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Bahía (1–6) que surte cada estación, cruzando su NP esperado con bay_layouts.',
  })
  layoutBays(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.bayService.getStationBays(model, revision ?? 'A');
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

  @Get('layout/staffing')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Estimación de personal: operadores por estación y total de la línea para sostener el takt.',
  })
  layoutStaffing(
    @Query('model') model: string,
    @Query('revision') revision?: string,
    @Query('availableTimeSec') availableTimeSec?: string,
    @Query('demandUnits') demandUnits?: string,
    @Query('taktTargetSec') taktTargetSec?: string,
  ) {
    return this.service.getStaffing({
      model,
      revision: revision ?? 'A',
      availableTimeSec: availableTimeSec ? Number(availableTimeSec) : undefined,
      demandUnits: demandUnits ? Number(demandUnits) : undefined,
      taktTargetSec: taktTargetSec ? Number(taktTargetSec) : undefined,
    });
  }

  @Get('layout/completeness')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Completitud documental por estación (NP, factor de uso, ayuda visual) para el overlay del layout.',
  })
  layoutCompleteness(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.getCompleteness(model, revision ?? 'A');
  }

  @Get('layout/flow')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Diagrama de flujo (spaghetti): distancia de recorrido, tramo más largo y cruces entre conexiones.',
  })
  layoutFlow(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.getFlowAnalysis(model, revision ?? 'A');
  }

  @Get('layout/flow-direction')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Dirección de flujo / retrocesos: eficiencia direccional y tramos que van contra el flujo.',
  })
  layoutFlowDirection(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.getFlowDirection(model, revision ?? 'A');
  }

  @Get('layout/collisions')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Validación del layout: solapes, holgura mínima (pasillos) y objetos fuera del footprint.',
  })
  layoutCollisions(
    @Query('model') model: string,
    @Query('revision') revision?: string,
    @Query('minClearance') minClearance?: string,
  ) {
    return this.service.getCollisions(
      model,
      revision ?? 'A',
      minClearance ? Number(minClearance) : 0,
    );
  }

  @Get('layout/auto-arrange')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Sugiere posiciones (serpentina por ruteo) para acomodar las estaciones en el footprint. No persiste.',
  })
  layoutAutoArrange(
    @Query('model') model: string,
    @Query('revision') revision?: string,
    @Query('serpentine') serpentine?: string,
    @Query('margin') margin?: string,
    @Query('gap') gap?: string,
  ) {
    return this.service.autoArrangeLayout(model, revision ?? 'A', {
      serpentine: serpentine === undefined ? true : serpentine !== 'false',
      margin: margin ? Number(margin) : undefined,
      gap: gap ? Number(gap) : undefined,
    });
  }

  @Get('layout/report')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Resumen consolidado del layout: readiness, uso de piso, flujo, conflictos y balance.',
  })
  layoutReport(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.getLayoutReport(model, revision ?? 'A');
  }

  @Get('layout/snapshots')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary: 'Lista las versiones guardadas del layout (más reciente primero).',
  })
  listSnapshots(
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.listSnapshots(model, revision ?? 'A');
  }

  @Post('layout/snapshots')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary: 'Guarda la disposición actual como una versión con nombre.',
  })
  createSnapshot(@Body() dto: CreateSnapshotDto) {
    return this.service.createSnapshot(
      dto.model,
      dto.revision ?? 'A',
      dto.name,
    );
  }

  @Post('layout/snapshots/:id/restore')
  @RequirePermissions('engineering:write')
  @ApiOperation({
    summary: 'Restaura una versión guardada sobre el layout en vivo.',
  })
  restoreSnapshot(
    @Param('id') id: string,
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.restoreSnapshot(model, revision ?? 'A', id);
  }

  @Delete('layout/snapshots/:id')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Elimina una versión guardada del layout.' })
  deleteSnapshot(
    @Param('id') id: string,
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.deleteSnapshot(model, revision ?? 'A', id);
  }

  @Get('layout/snapshots/:id/diff')
  @RequirePermissions('engineering:read')
  @ApiOperation({
    summary:
      'Compara una versión guardada con el layout en vivo: movidas, altas, bajas y cambios.',
  })
  diffSnapshot(
    @Param('id') id: string,
    @Query('model') model: string,
    @Query('revision') revision?: string,
  ) {
    return this.service.diffSnapshot(model, revision ?? 'A', id);
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
