import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ALLOWED_MODELS } from '../ai-pricing';

export class ConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(ALLOWED_MODELS)
  defaultModel?: string;

  @IsOptional()
  @IsIn(ALLOWED_MODELS)
  escalationModel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTokenBudget?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitPerHour?: number;
}
