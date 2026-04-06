import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProductionRuntimeService } from './production-runtime.service';
import { RegisterBayEventDto } from './dto/register-bay-event.dto';
import { CreateBayIncidentDto } from './dto/create-bay-incident.dto';

@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionRuntimeController {
  constructor(private readonly service: ProductionRuntimeService) {}

  @Get('backends')
  getBackends() {
    return this.service.getBackends();
  }

  @Get('backends/:kitId')
  getBackend(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getBackend(kitId);
  }

  @Post('backends/:kitId/receive')
  receive(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.receiveBackend(kitId);
  }

  @Post('backends/:kitId/start')
  start(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.startBackend(kitId);
  }

  @Post('backends/:kitId/bays/:bayId/events')
  createEvent(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: RegisterBayEventDto,
  ) {
    return this.service.registerBayEvent(kitId, bayId, dto);
  }

  @Post('events/:eventId/revert')
  revertEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.revertBayEvent(eventId);
  }

  @Get('backends/:kitId/events')
  getEvents(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getEvents(kitId);
  }

  @Get('backends/:kitId/materials')
  getMaterials(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getMaterials(kitId);
  }

  @Post('backends/:kitId/bays/:bayId/incidents')
  createIncident(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
    @Body() dto: CreateBayIncidentDto,
  ) {
    return this.service.createBayIncident(kitId, bayId, dto);
  }

  @Get('backends/:kitId/bays/:bayId/incidents')
  getIncidents(
    @Param('kitId', ParseIntPipe) kitId: number,
    @Param('bayId', ParseIntPipe) bayId: number,
  ) {
    return this.service.getBayIncidents(kitId, bayId);
  }

  @Get('backends/:kitId/hourly')
  getHourly(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getHourly(kitId);
  }

  @Get('backends/:kitId/shortage-risk')
  getShortage(@Param('kitId', ParseIntPipe) kitId: number) {
    return this.service.getShortageRisk(kitId);
  }

  @Get('completed')
  getCompleted() {
    return this.service.getCompleted();
  }

  @Get('logistics/shortage-risk')
  getLogisticsRisk() {
    return this.service.getLogisticsRisk();
  }
}
