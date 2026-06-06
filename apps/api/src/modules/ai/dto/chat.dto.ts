import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALLOWED_MODELS } from '../ai-pricing';

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Optional model override (must be an allowed model). Defaults to the cheap tier. */
  @IsOptional()
  @IsIn(ALLOWED_MODELS)
  model?: string;
}
