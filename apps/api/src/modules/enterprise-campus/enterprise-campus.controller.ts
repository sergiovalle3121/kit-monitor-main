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
import { EnterpriseCampusService } from './enterprise-campus.service';
import {
  CreateBuildingDto,
  UpdateBuildingDto,
  CreateCustomerDto,
  CreateProgramDto,
} from './dto/enterprise.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('enterprise')
export class EnterpriseCampusController {
  constructor(private readonly service: EnterpriseCampusService) {}

  @Get('buildings')
  getBuildings() {
    return this.service.listBuildings();
  }

  @Get('warehouses')
  getWarehouses() {
    return this.service.listWarehouses();
  }

  @Get('customers')
  getCustomers() {
    return this.service.listCustomers();
  }

  @Get('programs')
  getPrograms() {
    return this.service.listPrograms();
  }

  @Get('areas')
  getAreas() {
    return this.service.listAreas();
  }

  @Get('lines')
  getLines() {
    return this.service.listLines();
  }

  @Get('stations')
  getStations(@Query('lineId') lineId?: string) {
    return this.service.listStations(lineId);
  }

  @Get('campus-state')
  getCampusState() {
    return this.service.getCampusState();
  }

  // ==================== Admin CRUD (organización) ====================

  @Post('buildings')
  @RequirePermissions('ADMIN_ACCESS')
  createBuilding(@Body() dto: CreateBuildingDto) {
    return this.service.createBuilding(dto);
  }

  @Patch('buildings/:id')
  @RequirePermissions('ADMIN_ACCESS')
  updateBuilding(@Param('id') id: string, @Body() dto: UpdateBuildingDto) {
    return this.service.updateBuilding(id, dto);
  }

  @Delete('buildings/:id')
  @RequirePermissions('ADMIN_ACCESS')
  deleteBuilding(@Param('id') id: string) {
    return this.service.deleteBuilding(id);
  }

  @Post('customers')
  @RequirePermissions('ADMIN_ACCESS')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.service.createCustomer(dto);
  }

  @Delete('customers/:id')
  @RequirePermissions('ADMIN_ACCESS')
  deleteCustomer(@Param('id') id: string) {
    return this.service.deleteCustomer(id);
  }

  @Post('programs')
  @RequirePermissions('ADMIN_ACCESS')
  createProgram(@Body() dto: CreateProgramDto) {
    return this.service.createProgram(dto);
  }

  @Delete('programs/:id')
  @RequirePermissions('ADMIN_ACCESS')
  deleteProgram(@Param('id') id: string) {
    return this.service.deleteProgram(id);
  }
}
