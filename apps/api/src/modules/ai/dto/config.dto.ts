import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ALLOWED_MODELS } from '../ai-pricing';

export class ConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /**
   * BYO Anthropic API key. Send a key to store it (encrypted), an empty string
   * to clear it (revert to the platform key), or omit to leave it unchanged.
   */
  @IsOptional()
  @IsString()
  apiKey?: string;

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
