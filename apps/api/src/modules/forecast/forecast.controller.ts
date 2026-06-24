import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ForecastService } from './forecast.service';
import {
  CreateForecastDto,
  RunSimulationDto,
  SimulateDto,
  UpdateForecastDto,
} from './dto/forecast.dto';
import { AuthenticatedUser } from '../../common/types/jwt.types';

@ApiTags('forecast')
@Controller('forecast')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  // ── Stateless endpoint — no DB, no auth for tenant (open to any valid JWT) ──

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('planning:write')
  @ApiOperation({
    summary: 'Run a Monte Carlo simulation without persisting anything',
  })
  simulate(@Body() dto: SimulateDto) {
    return this.forecastService.simulateStateless(
      dto.input_data,
      dto.parameters,
    );
  }

  // ── Persisted forecasts ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all forecasts for the current tenant' })
  @ApiQuery({ name: 'model_id', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'completed', 'archived'],
  })
  findAll(
    @Query('model_id') model_id?: string,
    @Query('status') status?: string,
  ) {
    return this.forecastService.findAll({ model_id, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single forecast with results' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.forecastService.findOne(id);
  }

  @Post()
  @RequirePermissions('planning:write')
  @ApiOperation({ summary: 'Create a new forecast configuration' })
  create(
    @Body() dto: CreateForecastDto,
    @Req() req: { user: AuthenticatedUser },
  ) {
    // TenantInterceptor already loaded the context from req.user into
    // TenantContextService — the service reads it from AsyncLocalStorage.
    void req; // req.user drives context, service reads it via TenantContextService
    return this.forecastService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('planning:write')
  @ApiOperation({ summary: 'Update forecast metadata or input data' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateForecastDto,
  ) {
    return this.forecastService.update(id, dto);
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('planning:write')
  @ApiOperation({
    summary: 'Execute Monte Carlo simulation and persist results',
  })
  run(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RunSimulationDto) {
    return this.forecastService.runSimulation(id, dto.parameters);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('planning:write')
  @ApiOperation({ summary: 'Soft-delete a forecast' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.forecastService.remove(id);
  }
}
