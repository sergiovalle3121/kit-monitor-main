import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExecuteActionDto {
  @IsString()
  @MaxLength(64)
  actionKey: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
