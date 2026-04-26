import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Forecast } from './entities/forecast.entity';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';
import { MonteCarloService } from './monte-carlo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Forecast])],
  controllers: [ForecastController],
  providers: [ForecastService, MonteCarloService],
  exports: [ForecastService, MonteCarloService],
})
export class ForecastModule {}
