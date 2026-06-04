import { IsString, IsOptional, IsObject } from 'class-validator';

export class ExecuteTCodeDto {
  @IsString()
  tcode: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
