import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { MesExecutionService } from './mes-execution.service';
import {
  AcknowledgeFollowUpDto,
  AssignStationDto,
  ConfirmAdvanceDto,
  DispositionIncidentDto,
  EscalateFollowUpDto,
  OpenExecutionDto,
  RaiseAndonDto,
  RequestMaterialDto,
  ReplayOfflineQueueDto,
  ReportIncidentDto,
} from './dto/mes.dto';

type AuthRequest = { user?: { email?: string } };

@ApiTags('MES Execution')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('mes')
export class MesExecutionController {
  constructor(private readonly service: MesExecutionService) {}

  private actor(req: AuthRequest): string {
    return req?.user?.email ?? 'system';
  }

  /** Open (or re-open) a WO on the line by exploding its route + kit. */
  @Post('executions')
  @RequirePermissions('production:write')
  open(@Body() dto: OpenExecutionDto, @Request() req: AuthRequest) {
    return this.service.openExecution(dto, this.actor(req));
  }

  @Get('executions')
  @RequirePermissions('production:read')
  list(
    @Query('line') line?: string,
    @Query('status') status?: string,
    @Query('model') model?: string,
  ) {
    return this.service.listExecutions({ line, status, model });
  }

  /** The operator board (by workOrder or executionId, optionally a station). */
  @Get('board')
  @RequirePermissions('production:read')
  board(
    @Query('workOrder') workOrder?: string,
    @Query('executionId') executionId?: string,
    @Query('stepId') stepId?: string,
  ) {
    return this.service.getBoard({
      workOrder,
      executionId: executionId ? Number(executionId) : undefined,
      stepId: stepId ? Number(stepId) : undefined,
    });
  }

  @Get('executions/:id/board')
  @RequirePermissions('production:read')
  boardById(
    @Param('id', ParseIntPipe) id: number,
    @Query('stepId') stepId?: string,
  ) {
    return this.service.getBoard({
      executionId: id,
      stepId: stepId ? Number(stepId) : undefined,
    });
  }

  @Get('executions/:id/hourly')
  @RequirePermissions('production:read')
  hourly(@Param('id', ParseIntPipe) id: number) {
    return this.service.getHourly(id);
  }

  /** Confirm advance at a station → backflush. */
  @Post('executions/:id/steps/:stepId/confirm')
  @RequirePermissions('production:write')
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: ConfirmAdvanceDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.confirmAdvance(id, stepId, dto, this.actor(req));
  }

  /** Report a quality incident from the station (segregates / may block). */
  @Post('executions/:id/steps/:stepId/incidents')
  @RequirePermissions('production:write')
  incident(
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: ReportIncidentDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.reportIncident(id, stepId, dto, this.actor(req));
  }

  /** Quality dispositions a segregated incident (rework / scrap / use-as-is). */
  @Post('incidents/:id/disposition')
  @RequirePermissions('production:write')
  disposition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispositionIncidentDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.dispositionIncident(id, dto, this.actor(req));
  }

  /** Andon: summon materials / quality / maintenance / line-stop. */
  @Post('executions/:id/andon')
  @RequirePermissions('production:write')
  andon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RaiseAndonDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.raiseAndon(id, dto, this.actor(req));
  }

  /** Operator material pull from the active WO/line into the existing request flow. */
  @Post('executions/:id/material-request')
  @RequirePermissions('production:write')
  requestMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RequestMaterialDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.requestMaterial(id, dto, this.actor(req));
  }

  @Post('offline/replay')
  @RequirePermissions('production:write')
  replayOfflineQueue(
    @Body() dto: ReplayOfflineQueueDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.replayOfflineQueue(dto, this.actor(req));
  }

  @Post('follow-ups/ack')
  @RequirePermissions('production:write')
  acknowledgeFollowUp(
    @Body() dto: AcknowledgeFollowUpDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.acknowledgeFollowUp(dto, this.actor(req));
  }

  @Post('follow-ups/escalate')
  @RequirePermissions('production:write')
  escalateFollowUp(
    @Body() dto: EscalateFollowUpDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.escalateFollowUp(dto, this.actor(req));
  }

  @Post('andon/:id/ack')
  @RequirePermissions('production:write')
  ackAndon(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.service.updateAndon(id, 'ack', this.actor(req));
  }

  @Post('andon/:id/resolve')
  @RequirePermissions('production:write')
  resolveAndon(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthRequest,
  ) {
    return this.service.updateAndon(id, 'resolve', this.actor(req));
  }

  /** Undo the last confirmed advance (within a 3-minute window). */
  @Post('events/:id/revert')
  @RequirePermissions('production:write')
  revert(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.service.revertEvent(id, this.actor(req));
  }

  /** Supervisor assigns an operator to a station for this execution. */
  @Post('executions/:id/assignments')
  @RequirePermissions('production:write')
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignStationDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.assignStation(id, dto, this.actor(req));
  }
}
