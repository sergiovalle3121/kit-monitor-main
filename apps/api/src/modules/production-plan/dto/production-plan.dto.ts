import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WORK_ORDER_STATUSES } from '../wo-state';
import type { WorkOrderStatus } from '../wo-state';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CONSUMPTION = ['BY_UNIT', 'BY_QTY_FACTOR'];
const SERIAL = ['NONE', 'BY_UNIT'];

export class PublishWorkOrderDto {
  @ApiProperty({ example: 'AX-1000' })
  @IsString()
  @Length(1, 64)
  model: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  revision?: string;

  @ApiProperty({ example: 'SMT-1' })
  @IsString()
  @Length(1, 32)
  line: string;

  @ApiPropertyOptional({ example: 'BAY-2' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  bay?: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  quantityPlanned: number;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  sequence?: number;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  @ApiPropertyOptional({ enum: CONSUMPTION, description: 'Por unidad (1 Enter=1 pza) o por cantidad×factor.' })
  @IsOptional()
  @IsIn(CONSUMPTION)
  consumptionMode?: 'BY_UNIT' | 'BY_QTY_FACTOR';

  @ApiPropertyOptional({ enum: SERIAL, description: 'Serial por unidad (genealogía) o solo cantidad.' })
  @IsOptional()
  @IsIn(SERIAL)
  serialControl?: 'NONE' | 'BY_UNIT';

  @ApiPropertyOptional({ example: 50, description: 'Takt target (s). 0 = derivar.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taktTargetSec?: number;

  @ApiPropertyOptional({ description: 'Exigir aprobación de primera pieza (FAI) antes de correr.' })
  @IsOptional()
  @IsBoolean()
  faiRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class ResequenceDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  sequence: number;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export class TransitionWorkOrderDto {
  @ApiProperty({ enum: WORK_ORDER_STATUSES })
  @IsIn(WORK_ORDER_STATUSES)
  status: WorkOrderStatus;
}

export class AuthorizeOperatorsDto {
  @ApiProperty({ type: [String], example: ['op1@plant.com', 'op2@plant.com'] })
  @IsArray()
  @IsEmail({}, { each: true })
  operators: string[];
}
