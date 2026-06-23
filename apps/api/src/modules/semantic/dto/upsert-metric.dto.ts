import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertMetricDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  grain?: string;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsIn(['up', 'down'])
  direction?: 'up' | 'down';

  /** Target/threshold for KPI alerts (compared with `direction`). Null clears it. */
  @IsOptional()
  @IsNumber()
  target?: number | null;
}
