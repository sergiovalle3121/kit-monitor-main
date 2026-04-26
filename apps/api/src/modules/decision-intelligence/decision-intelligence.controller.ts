import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DecisionIntelligenceService } from './decision-intelligence.service';
import { CreateForecastRunDto } from './dto/create-forecast-run.dto';
import { CreatePlanScenarioDto } from './dto/create-plan-scenario.dto';
import { CreatePlanPublicationDto } from './dto/create-plan-publication.dto';
import { RunSimulationDto } from './dto/run-simulation.dto';
import { RegisterOutcomeDto } from './dto/register-outcome.dto';

@UseGuards(JwtAuthGuard)
@Controller('decision-intelligence')
export class DecisionIntelligenceController {
  constructor(private readonly service: DecisionIntelligenceService) {}

  @Post('forecast-runs')
  createForecastRun(@Body() dto: CreateForecastRunDto) {
    return this.service.createForecastRun(dto);
  }

  @Get('forecast-runs')
  listForecastRuns() {
    return this.service.listForecastRuns();
  }

  @Get('forecast-runs/:id')
  getForecastRun(@Param('id', ParseIntPipe) id: number) {
    return this.service.getForecastRun(id);
  }

  @Post('plan-scenarios')
  createPlanScenario(@Body() dto: CreatePlanScenarioDto) {
    return this.service.createPlanScenario(dto);
  }

  @Get('plan-scenarios')
  listPlanScenarios() {
    return this.service.listPlanScenarios();
  }

  @Get('plan-scenarios/:id')
  getPlanScenario(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPlanScenario(id);
  }

  @Post('plan-publications')
  publishPlan(@Body() dto: CreatePlanPublicationDto) {
    return this.service.publishPlan(dto);
  }

  @Get('plan-publications')
  listPublications() {
    return this.service.listPublications();
  }

  @Get('logistics-priority')
  getLogisticsPriority(@Query('runId') runId?: string) {
    return this.service.getLogisticPriority(runId ? Number(runId) : undefined);
  }

  @Post('plan-scenarios/:id/simulate')
  runSimulation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RunSimulationDto,
  ) {
    return this.service.runScenarioSimulation(id, dto);
  }

  @Get('plan-scenarios/:id/simulation')
  getScenarioSimulation(@Param('id', ParseIntPipe) id: number) {
    return this.service.runScenarioSimulation(id, {});
  }

  @Post('plan-publications/:id/outcome')
  registerOutcome(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegisterOutcomeDto,
  ) {
    return this.service.registerPublicationOutcome(id, dto);
  }

  @Get('plan-publications/:id/control-tower')
  getControlTower(@Param('id', ParseIntPipe) id: number) {
    return this.service.getControlTower(id);
  }

  @Get('calibration/summary')
  getCalibrationSummary() {
    return this.service.getCalibrationSummary();
  }

  @Get('site-overview')
  async getSiteOverview() {
    return this.service.getSiteOverview();
  }
}
