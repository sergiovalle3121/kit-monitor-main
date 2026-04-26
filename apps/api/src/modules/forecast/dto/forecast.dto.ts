import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsIn,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HistoricalDataPointDto {
  @ApiProperty({ example: '2026-01-06' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 42 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: 'Week 1' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class SimulationParamsDto {
  @ApiPropertyOptional({ example: 1000, description: 'Monte Carlo iterations' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(50000)
  iterations?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Periods to project forward',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(104)
  periods?: number;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  periodUnit?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ example: [10, 50, 90] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(99, { each: true })
  confidenceLevels?: number[];

  @ApiPropertyOptional({ enum: ['normal', 'lognormal'] })
  @IsOptional()
  @IsIn(['normal', 'lognormal'])
  distribution?: 'normal' | 'lognormal';
}

export class CreateForecastDto {
  @ApiProperty({ example: 'Q3 2026 — Model WH-200 Demand' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'WH-200' })
  @IsOptional()
  @IsString()
  model_id?: string;

  @ApiPropertyOptional({ type: [HistoricalDataPointDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => HistoricalDataPointDto)
  input_data?: HistoricalDataPointDto[];

  @ApiPropertyOptional({ type: SimulationParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationParamsDto)
  parameters?: SimulationParamsDto;
}

export class RunSimulationDto {
  @ApiPropertyOptional({
    type: SimulationParamsDto,
    description: 'Override stored params for this run',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationParamsDto)
  parameters?: SimulationParamsDto;
}

/** Stateless endpoint — provide everything, nothing is persisted. */
export class SimulateDto {
  @ApiProperty({ type: [HistoricalDataPointDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => HistoricalDataPointDto)
  input_data: HistoricalDataPointDto[];

  @ApiPropertyOptional({ type: SimulationParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationParamsDto)
  parameters?: SimulationParamsDto;
}

export class UpdateForecastDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model_id?: string;

  @ApiPropertyOptional({ type: [HistoricalDataPointDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => HistoricalDataPointDto)
  input_data?: HistoricalDataPointDto[];

  @ApiPropertyOptional({ type: SimulationParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationParamsDto)
  parameters?: SimulationParamsDto;

  @ApiPropertyOptional({ enum: ['draft', 'completed', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'completed', 'archived'])
  status?: string;
}
