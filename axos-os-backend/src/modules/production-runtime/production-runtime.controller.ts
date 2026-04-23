import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductionRuntimeService } from './production-runtime.service';
import { RegisterBayEventDto } from './dto/register-bay-event.dto';
import { CreateBayIncidentDto } from './dto/create-bay-incident.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Request } from '@nestjs/common';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production-runtime')
export class ProductionRuntimeController {
  constructor(private readonly service: ProductionRuntimeService) {}

  @Get('lines')
  @RequirePermissions('production:read')
  getLines(
    @Request() req: any,
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.getLines(req.user, { line, model, workOrder, buildingId, programId });
  }

  @Get('lines/:kitId')
  @RequirePermissions('production:read')
  getLine(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.getLine(kitId, req.user);
  }

  @Post('lines/:kitId/receive')
  @RequirePermissions('production:write')
  receive(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.receiveLine(kitId, req.user);
  }

  @Post('lines/:kitId/start')
  @RequirePermissions('production:write')
  start(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.startLine(kitId, req.user);
  }

  @Post('lines/:kitId/bays/:bayId/events')
  @RequirePermissions('production:write')
  createEvent(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: RegisterBayEventDto,
    @Request() req: any,
  ) {
    return this.service.registerBayEvent(kitId, bayId, dto, req.user);
  }

  @Post('events/:eventId/revert')
  @RequirePermissions('production:write')
  revertEvent(@Param('eventId', ParseIntPipe) eventId: number, @Request() req: any) {
    return this.service.revertBayEvent(eventId, req.user);
  }

  @Get('lines/:kitId/events')
  @RequirePermissions('production:read')
  getEvents(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.getEvents(kitId, req.user);
  }

  @Get('lines/:kitId/materials')
  @RequirePermissions('production:read')
  getMaterials(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.getMaterials(kitId, req.user);
  }

  @Post('lines/:kitId/bays/:bayId/incidents')
  @RequirePermissions('production:write')
  createIncident(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: CreateBayIncidentDto,
    @Request() req: any,
  ) {
    return this.service.createBayIncident(kitId, bayId, dto, req.user);
  }

  @Get('lines/:kitId/bays/:bayId/incidents')
  @RequirePermissions('production:read')
  getIncidents(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Request() req: any,
  ) {
    return this.service.getBayIncidents(kitId, bayId, req.user);
  }

  @Get('lines/:kitId/hourly')
  @RequirePermissions('production:read')
  getHourly(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.getHourly(kitId, req.user);
  }

  @Get('lines/:kitId/shortage-risk')
  @RequirePermissions('production:read')
  getShortage(@Param('kitId', ParseIntPipe) kitId: number, @Request() req: any) {
    return this.service.getShortageRisk(kitId, req.user);
  }

  @Get('completed')
  @RequirePermissions('production:read')
  getCompleted(
    @Request() req: any,
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.getCompleted(req.user, { line, model, workOrder, buildingId, programId });
  }

  @Get('logistics/shortage-risk')
  @RequirePermissions('materials:read')
  getLogisticsRisk(@Request() req: any) {
    return this.service.getLogisticsRisk(req.user);
  }

  @Get('wip')
  @RequirePermissions('production:read')
  async getWip(@Query() scope: any, @Request() req: any) {
    return this.service.getWipStatus(scope, req.user);
  }

  @Post('wip/:kitId/declare-fg')
  @RequirePermissions('production:write')
  async declareFg(@Param('kitId') kitId: number, @Body() dto: { quantity: number; actor: string }, @Request() req: any) {
    return this.service.declareFinishedGoods(kitId, dto.quantity, dto.actor, req.user);
  }
}
