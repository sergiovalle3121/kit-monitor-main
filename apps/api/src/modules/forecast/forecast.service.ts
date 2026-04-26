import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Forecast, ForecastStatus, HistoricalDataPoint, SimulationParams } from './entities/forecast.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MonteCarloService } from './monte-carlo.service';
import { CreateForecastDto, UpdateForecastDto } from './dto/forecast.dto';

@Injectable()
export class ForecastService {
  constructor(
    @InjectRepository(Forecast)
    private readonly repo: Repository<Forecast>,
    private readonly tenantContext: TenantContextService,
    private readonly monteCarlo: MonteCarloService,
  ) {}

  async findAll(filters?: { model_id?: string; status?: string }): Promise<Forecast[]> {
    const qb = this.repo.createQueryBuilder('f').orderBy('f.created_at', 'DESC');

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('f.tenant_id = :tenantId', { tenantId });

    if (filters?.model_id) qb.andWhere('f.model_id = :modelId', { modelId: filters.model_id });
    if (filters?.status) qb.andWhere('f.status = :status', { status: filters.status });

    return qb.getMany();
  }

  async findOne(id: string): Promise<Forecast> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id };
    if (tenantId) where['tenant_id'] = tenantId;

    const forecast = await this.repo.findOne({ where: where as any });
    if (!forecast) throw new NotFoundException(`Forecast ${id} not found`);
    return forecast;
  }

  async create(dto: CreateForecastDto): Promise<Forecast> {
    const forecast = this.repo.create({
      ...dto,
      tenant_id: this.tenantContext.getTenantId(),
      organization_id: this.tenantContext.getOrganizationId(),
      plant_id: this.tenantContext.getPlantId(),
      created_by: this.tenantContext.getUserEmail(),
      status: ForecastStatus.DRAFT,
      run_count: 0,
    });
    return this.repo.save(forecast);
  }

  async update(id: string, dto: UpdateForecastDto): Promise<Forecast> {
    const forecast = await this.findOne(id);
    Object.assign(forecast, dto);
    return this.repo.save(forecast);
  }

  async remove(id: string): Promise<void> {
    const forecast = await this.findOne(id);
    await this.repo.softRemove(forecast);
  }

  async runSimulation(id: string, paramsOverride?: Partial<SimulationParams>): Promise<Forecast> {
    const forecast = await this.findOne(id);

    if (!forecast.input_data || forecast.input_data.length < 2) {
      throw new NotFoundException('Forecast needs at least 2 historical data points to run a simulation');
    }

    const params = paramsOverride
      ? { ...forecast.parameters, ...paramsOverride }
      : forecast.parameters;

    forecast.result = this.monteCarlo.run(forecast.input_data, params);
    forecast.status = ForecastStatus.COMPLETED;
    forecast.run_count += 1;

    return this.repo.save(forecast);
  }

  /** Stateless simulation — no DB read or write. For the interactive lab UI. */
  simulateStateless(
    inputData: HistoricalDataPoint[],
    params?: Partial<SimulationParams>,
  ) {
    return this.monteCarlo.run(inputData, params);
  }
}
