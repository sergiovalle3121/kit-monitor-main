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
  constructor(private readonly service: TrafficService) {}

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
}
