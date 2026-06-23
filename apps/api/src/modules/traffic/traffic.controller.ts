import {
  Body,
  Controller,
  Delete,
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
import { TrafficService } from './traffic.service';
import { TrafficAlertsService } from './traffic-alerts.service';
import { TrafficAppointmentsService } from './traffic-appointments.service';
import {
  CreateCarrierDto,
  CreateDockDto,
  CreateDriverDto,
  CreateVehicleDto,
  UpdateCarrierDto,
  UpdateDockDto,
  UpdateDriverDto,
  UpdateVehicleDto,
} from './dto/traffic.dto';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

/**
 * Traffic (Tráfico) master data: carriers, vehicles, drivers and loading docks.
 * Reads need `logistics:read`; mutations need `logistics:write`. Admin/owner
 * bypasses via the guard. These catalogs feed the transport-assignment poka-yoke
 * on outbound shipments (POST /outbound/shipments/:id/assign-transport).
 */
@ApiTags('Traffic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('traffic')
export class TrafficController {
  constructor(
    private readonly service: TrafficService,
    private readonly alerts: TrafficAlertsService,
    private readonly appointments: TrafficAppointmentsService,
  ) {}

  // ── Carriers ───────────────────────────────────────────────────────────────
  @Get('carriers')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista transportistas.' })
  listCarriers(@Query('q') q?: string, @Query('status') status?: string) {
    return this.service.listCarriers({ q, status });
  }

  @Get('carriers/:id')
  @RequirePermissions('logistics:read')
  getCarrier(@Param('id') id: string) {
    return this.service.getCarrier(id);
  }

  @Post('carriers')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Crea un transportista.' })
  createCarrier(@Body() dto: CreateCarrierDto) {
    return this.service.createCarrier(dto);
  }

  @Patch('carriers/:id')
  @RequirePermissions('logistics:write')
  updateCarrier(@Param('id') id: string, @Body() dto: UpdateCarrierDto) {
    return this.service.updateCarrier(id, dto);
  }

  @Delete('carriers/:id')
  @RequirePermissions('logistics:write')
  removeCarrier(@Param('id') id: string) {
    return this.service.removeCarrier(id);
  }

  // ── Vehicles ───────────────────────────────────────────────────────────────
  @Get('vehicles')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista unidades (vehículos).' })
  listVehicles(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('carrierId') carrierId?: string,
  ) {
    return this.service.listVehicles({ q, status, type, carrierId });
  }

  @Get('vehicles/:id')
  @RequirePermissions('logistics:read')
  getVehicle(@Param('id') id: string) {
    return this.service.getVehicle(id);
  }

  @Post('vehicles')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Crea una unidad.' })
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.service.createVehicle(dto);
  }

  @Patch('vehicles/:id')
  @RequirePermissions('logistics:write')
  updateVehicle(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.updateVehicle(id, dto);
  }

  @Delete('vehicles/:id')
  @RequirePermissions('logistics:write')
  removeVehicle(@Param('id') id: string) {
    return this.service.removeVehicle(id);
  }

  // ── Drivers ────────────────────────────────────────────────────────────────
  @Get('drivers')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista choferes.' })
  listDrivers(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('carrierId') carrierId?: string,
  ) {
    return this.service.listDrivers({ q, status, carrierId });
  }

  @Get('drivers/:id')
  @RequirePermissions('logistics:read')
  getDriver(@Param('id') id: string) {
    return this.service.getDriver(id);
  }

  @Post('drivers')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Crea un chofer.' })
  createDriver(@Body() dto: CreateDriverDto) {
    return this.service.createDriver(dto);
  }

  @Patch('drivers/:id')
  @RequirePermissions('logistics:write')
  updateDriver(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.service.updateDriver(id, dto);
  }

  @Delete('drivers/:id')
  @RequirePermissions('logistics:write')
  removeDriver(@Param('id') id: string) {
    return this.service.removeDriver(id);
  }

  // ── Loading docks ──────────────────────────────────────────────────────────
  @Get('docks')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista andenes.' })
  listDocks(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.service.listDocks({ q, status, type });
  }

  @Get('docks/:id')
  @RequirePermissions('logistics:read')
  getDock(@Param('id') id: string) {
    return this.service.getDock(id);
  }

  @Post('docks')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Crea un andén.' })
  createDock(@Body() dto: CreateDockDto) {
    return this.service.createDock(dto);
  }

  @Patch('docks/:id')
  @RequirePermissions('logistics:write')
  updateDock(@Param('id') id: string, @Body() dto: UpdateDockDto) {
    return this.service.updateDock(id, dto);
  }

  @Delete('docks/:id')
  @RequirePermissions('logistics:write')
  removeDock(@Param('id') id: string) {
    return this.service.removeDock(id);
  }

  // ── Dock board operations (Tablero de andenes) ───────────────────────────────
  @Post('docks/:id/start-loading')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Marca un andén ocupado como EN CARGA.' })
  startLoading(@Param('id') id: string) {
    return this.service.startLoading(id);
  }

  @Post('docks/:id/stop-loading')
  @RequirePermissions('logistics:write')
  @ApiOperation({
    summary: 'Quita la marca EN CARGA del andén (sin liberarlo).',
  })
  stopLoading(@Param('id') id: string) {
    return this.service.stopLoading(id);
  }

  // ── Alertas de patio (buzón de notificaciones) ───────────────────────────────
  @Post('dock-alerts/run')
  @RequirePermissions('logistics:write')
  @ApiOperation({
    summary:
      'Dispara el barrido de sobreestadía de andenes y deja avisos en el buzón. Idéntico al cron, bajo demanda.',
  })
  runDockAlerts() {
    return this.alerts.scanDockOverstayAndNotify();
  }

  // ── Dock appointments (Citas de andén) ───────────────────────────────────────
  @Get('appointments')
  @RequirePermissions('logistics:read')
  @ApiOperation({ summary: 'Lista citas de andén (con filtros).' })
  listAppointments(
    @Query('status') status?: string,
    @Query('direction') direction?: string,
    @Query('dockId') dockId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.appointments.list({ status, direction, dockId, from, to, q });
  }

  @Get('appointments/:id')
  @RequirePermissions('logistics:read')
  getAppointment(@Param('id') id: string) {
    return this.appointments.get(id);
  }

  @Post('appointments')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Programa una cita de andén.' })
  createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.appointments.create(dto);
  }

  @Patch('appointments/:id')
  @RequirePermissions('logistics:write')
  updateAppointment(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(id, dto);
  }

  @Delete('appointments/:id')
  @RequirePermissions('logistics:write')
  removeAppointment(@Param('id') id: string) {
    return this.appointments.remove(id);
  }

  @Post('appointments/:id/arrive')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Registra la llegada de la unidad (gate-in).' })
  arriveAppointment(@Param('id') id: string) {
    return this.appointments.setStatus(id, 'arrived');
  }

  @Post('appointments/:id/complete')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Cierra la cita y registra la salida (gate-out).' })
  completeAppointment(@Param('id') id: string) {
    return this.appointments.setStatus(id, 'completed');
  }

  @Post('appointments/:id/cancel')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Cancela la cita.' })
  cancelAppointment(@Param('id') id: string) {
    return this.appointments.setStatus(id, 'cancelled');
  }

  @Post('appointments/:id/no-show')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Marca la cita como no-show.' })
  noShowAppointment(@Param('id') id: string) {
    return this.appointments.setStatus(id, 'no_show');
  }
}
