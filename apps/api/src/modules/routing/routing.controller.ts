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
import { RoutingService } from './routing.service';
import {
  CreateOperationDto,
  CreateOperationMaterialDto,
  CreateRoutingDto,
  TransitionRoutingDto,
  UpdateOperationDto,
  UpdateRoutingDto,
} from './dto/routing.dto';

/**
 * Routing (Engineering / IE). A routing (`rt_routing`) per assembly material with
 * ordered operations (`rt_operation`: work center, standard setup/run times,
 * instructions) and the BOM bridge (`rt_operation_material`: which materials are
 * consumed at which operation → correct backflush).
 */
@ApiTags('Routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('routing')
export class RoutingController {
  constructor(private readonly service: RoutingService) {}

  // Routing header
  @Get()
  @ApiOperation({ summary: 'Lista ruteos (por ensamble).' })
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.listRoutings({ search, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un ruteo con operaciones y materiales.' })
  getOne(@Param('id') id: string) {
    return this.service.getRouting(id);
  }

  @Get(':id/totals')
  @ApiOperation({ summary: 'Tiempo estándar del ruteo para un lote de qty.' })
  totals(@Param('id') id: string, @Query('qty') qty?: string) {
    return this.service.totals(id, qty ? Number(qty) : 1);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un ruteo para un material/ensamble.' })
  create(@Body() dto: CreateRoutingDto) {
    return this.service.createRouting(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza el header del ruteo.' })
  update(@Param('id') id: string, @Body() dto: UpdateRoutingDto) {
    return this.service.updateRouting(id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Cambia el estado del ruteo.' })
  transition(@Param('id') id: string, @Body() dto: TransitionRoutingDto) {
    return this.service.transitionRouting(id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina el ruteo, sus operaciones y materiales.' })
  remove(@Param('id') id: string) {
    return this.service.deleteRouting(id);
  }

  // Operations
  @Post(':id/operations')
  @ApiOperation({ summary: 'Agrega una operación al ruteo.' })
  addOperation(@Param('id') id: string, @Body() dto: CreateOperationDto) {
    return this.service.addOperation(id, dto);
  }

  @Patch(':id/operations/:opId')
  @ApiOperation({ summary: 'Actualiza una operación.' })
  updateOperation(
    @Param('id') id: string,
    @Param('opId') opId: string,
    @Body() dto: UpdateOperationDto,
  ) {
    return this.service.updateOperation(id, opId, dto);
  }

  @Delete(':id/operations/:opId')
  @ApiOperation({ summary: 'Elimina una operación.' })
  removeOperation(@Param('id') id: string, @Param('opId') opId: string) {
    return this.service.removeOperation(id, opId);
  }

  // Operation ↔ material (BOM bridge)
  @Post(':id/operations/:opId/materials')
  @ApiOperation({ summary: 'Asigna un material consumido a la operación (backflush).' })
  addOperationMaterial(
    @Param('id') id: string,
    @Param('opId') opId: string,
    @Body() dto: CreateOperationMaterialDto,
  ) {
    return this.service.addOperationMaterial(id, opId, dto);
  }

  @Delete(':id/operations/:opId/materials/:matId')
  @ApiOperation({ summary: 'Quita un material de la operación.' })
  removeOperationMaterial(
    @Param('id') id: string,
    @Param('opId') opId: string,
    @Param('matId') matId: string,
  ) {
    return this.service.removeOperationMaterial(id, opId, matId);
  }
}
