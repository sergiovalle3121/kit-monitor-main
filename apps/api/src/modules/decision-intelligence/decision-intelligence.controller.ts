import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DecisionIntelligenceService } from './decision-intelligence.service';
import { MonteCarloService, StressTestConfigDto } from './monte-carlo.service';
import { CreateForecastRunDto } from './dto/create-forecast-run.dto';
import { CreatePlanScenarioDto } from './dto/create-plan-scenario.dto';
import { CreatePlanPublicationDto } from './dto/create-plan-publication.dto';
import { RunSimulationDto } from './dto/run-simulation.dto';
import { RegisterOutcomeDto } from './dto/register-outcome.dto';

@ApiTags('Decision Intelligence')
@UseGuards(JwtAuthGuard)
@Controller('decision-intelligence')
export class DecisionIntelligenceController {
  constructor(
    private readonly service: DecisionIntelligenceService,
    private readonly monteCarlo: MonteCarloService,
  ) {}

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
  runSimulation(@Param('id', ParseIntPipe) id: number, @Body() dto: RunSimulationDto) {
    return this.service.runScenarioSimulation(id, dto);
  }

  @Get('plan-scenarios/:id/simulation')
  getScenarioSimulation(@Param('id', ParseIntPipe) id: number) {
    return this.service.runScenarioSimulation(id, {});
  }

  @Post('plan-publications/:id/outcome')
  registerOutcome(@Param('id', ParseIntPipe) id: number, @Body() dto: RegisterOutcomeDto) {
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

  // ── SPC / Sigma Stability Engine ─────────────────────────────────────────

  @Get('stability-report')
  @ApiOperation({
    summary: 'SPC Stability Report — Sigma & control limits for a production line/model',
    description:
      'Analyses cycle times from ProductionBayEvent history and returns a Statistical ' +
      'Process Control report: mean, σ, UCL/LCL, Z-scores, and out-of-control event counts.',
  })
  @ApiQuery({ name: 'line', required: false, description: 'Line identifier (e.g. "BK1")' })
  @ApiQuery({ name: 'model', required: false, description: 'Model code (e.g. "XA-220")' })
  @ApiQuery({ name: 'windowHours', required: false, description: 'Analysis window in hours (default 8)' })
  getStabilityReport(
    @Query('line')  line?:  string,
    @Query('model') model?: string,
    @Query('windowHours') windowHours?: string,
  ) {
    return this.service.getStabilityReport(line, model, windowHours ? Number(windowHours) : undefined);
  }

  // ── Monte Carlo Stress Testing ────────────────────────────────────────────

  @Post('plan-scenarios/:id/stress-test')
  @ApiOperation({
    summary: 'Monte Carlo Stress Test — Supply Chain Failure or Labor Shortage scenarios',
    description:
      'Runs a stressed Monte Carlo simulation for a plan scenario. ' +
      'Scenario A: Supply Chain Failure (supplyReductionFraction 0.0–1.0). ' +
      'Scenario B: Labor Shortage (capacityReductionFraction 0.0–1.0). ' +
      'Both can be combined for worst-case analysis.',
  })
  runStressTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StressTestConfigDto,
  ) {
    return this.monteCarlo.runStressTest(id, dto);
  }
}
