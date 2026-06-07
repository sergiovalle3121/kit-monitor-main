import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TOOL_STATUSES, TOOL_TYPES } from '../tool-life';
import type { ToolStatus, ToolType } from '../tool-life';

export class CreateToolDto {
  @ApiProperty({ example: 'Molde carcasa frontal' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({ enum: TOOL_TYPES })
  @IsOptional()
  @IsIn(TOOL_TYPES as unknown as string[])
  type?: ToolType;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cavities?: number;

  @ApiProperty({ example: 1000000, description: 'Vida nominal en disparos.' })
  @IsInt()
  @Min(0)
  lifeShots: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  shotsUsed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

export class RecordUsageDto {
  @ApiProperty({ example: 5000, description: 'Disparos a sumar.' })
  @IsInt()
  @Min(1)
  shots: number;
}

export class SetToolStatusDto {
  @ApiProperty({ enum: TOOL_STATUSES, example: 'IN_USE' })
  @IsIn(TOOL_STATUSES as unknown as string[])
  status: ToolStatus;
}
