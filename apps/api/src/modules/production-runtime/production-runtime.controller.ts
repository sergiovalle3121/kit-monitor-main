import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductionRuntimeService } from './production-runtime.service';
import { RegisterBayEventDto } from './dto/register-bay-event.dto';
import { CreateBayIncidentDto } from './dto/create-bay-incident.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('production-runtime')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('production-runtime')
export class ProductionRuntimeController {
  constructor(private readonly service: ProductionRuntimeService) {}

  @Get('lines')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary: 'List active production lines (kits in-progress or ready)',
  })
  @ApiQuery({ name: 'line', required: false })
  @ApiQuery({ name: 'model', required: false })
  @ApiQuery({ name: 'workOrder', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  getLines(
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.getLines({
      line,
      model,
      workOrder,
      buildingId,
      programId,
    });
  }

  @Get('lines/:kitId')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get backend view for a specific kit/line' })
  getLine(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getLine(kitId);
  }

  @Post('lines/:kitId/receive')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Receive kit at production line' })
  receive(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.receiveLine(kitId);
  }

  @Post('lines/:kitId/start')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Start assembly for a kit on the line' })
  start(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.startLine(kitId);
  }

  @Post('lines/:kitId/bays/:bayId/events')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Register a production bay assembly event' })
  createEvent(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: RegisterBayEventDto,
  ) {
    return this.service.registerBayEvent(kitId, bayId, dto);
  }

  @Post('events/:eventId/revert')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Revert a bay event within the undo window' })
  revertEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.revertBayEvent(eventId);
  }

  @Get('lines/:kitId/events')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get all bay events for a kit' })
  getEvents(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getEvents(kitId);
  }

  @Get('lines/:kitId/materials')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary: 'Get real-time material state for all bays of a kit',
  })
  getMaterials(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getMaterials(kitId);
  }

  @Post('lines/:kitId/bays/:bayId/incidents')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Report a bay incident (material shortage, assembly error, etc.)',
  })
  createIncident(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: CreateBayIncidentDto,
  ) {
    return this.service.createBayIncident(kitId, bayId, dto);
  }

  @Get('lines/:kitId/bays/:bayId/incidents')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get open incidents for a specific bay' })
  getIncidents(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
  ) {
    return this.service.getBayIncidents(kitId, bayId);
  }

  @Get('lines/:kitId/hourly')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get hourly production totals per bay for a kit' })
  getHourly(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getHourly(kitId);
  }

  @Get('lines/:kitId/shortage-risk')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get material shortage risk analysis for a kit' })
  getShortage(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getShortageRisk(kitId);
  }

  @Get('completed')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'List completed kits' })
  @ApiQuery({ name: 'line', required: false })
  @ApiQuery({ name: 'model', required: false })
  @ApiQuery({ name: 'workOrder', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  getCompleted(
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.getCompleted({
      line,
      model,
      workOrder,
      buildingId,
      programId,
    });
  }

  @Get('logistics/shortage-risk')
  @RequirePermissions('materials:read')
  @ApiOperation({
    summary: 'Get logistics-wide shortage risk across all active lines',
  })
  getLogisticsRisk() {
    return this.service.getLogisticsRisk();
  }

  @Get('wip')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Get WIP status records' })
  @ApiQuery({ name: 'workOrder', required: false })
  async getWip(@Query() scope: any) {
    return this.service.getWipStatus(scope);
  }

  @Post('wip/:kitId/declare-fg')
  @RequirePermissions('production:write')
  @ApiOperation({ summary: 'Declare finished goods from a WIP record' })
  async declareFg(
    @Param('kitId') kitId: number,
    @Body() dto: { quantity: number; actor: string },
  ) {
    return this.service.declareFinishedGoods(kitId, dto.quantity, dto.actor);
  }
}
