import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CYCLE_COUNT_STATUSES } from '../count-state';
import type { CycleCountStatus } from '../count-state';

export class CreateCycleCountDto {
  @ApiProperty({ example: 'RES-0402-10K' })
  @IsString()
  @Length(1, 80)
  partNumber: string;

  @ApiPropertyOptional({ example: 'A-12-03' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  location?: string;

  @ApiPropertyOptional({ example: 'PCS' })
  @IsOptional()
  @IsString()
  @Length(0, 12)
  uom?: string;

  @ApiProperty({ example: 5000, description: 'Cantidad en sistema.' })
  @IsNumber()
  @Min(0)
  systemQty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

export class RecordCountDto {
  @ApiProperty({ example: 4980, description: 'Cantidad contada físicamente.' })
  @IsNumber()
  @Min(0)
  countedQty: number;
}

export class TransitionCycleCountDto {
  @ApiProperty({ enum: CYCLE_COUNT_STATUSES, example: 'RECONCILED' })
  @IsIn(CYCLE_COUNT_STATUSES)
  status: CycleCountStatus;
}
