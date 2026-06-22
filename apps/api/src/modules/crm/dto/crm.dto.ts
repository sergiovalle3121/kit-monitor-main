import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OPPORTUNITY_STATUSES } from '../opportunity-state';
import type { OpportunityStatus } from '../opportunity-state';

export class CreateOpportunityDto {
  @ApiProperty({ example: 'Programa Servers Gen6 — Cliente C' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  contactName?: string;

  @ApiPropertyOptional({ example: 2500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 30, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ description: 'Owning crm_accounts id.' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  accountId?: string;

  @ApiPropertyOptional({ example: 'RFQ' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitor?: string;

  @ApiPropertyOptional({ example: 'PCBA' })
  @IsOptional()
  @IsString()
  productLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextStep?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsString()
  nextStepDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOpportunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  competitor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextStep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextStepDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransitionOpportunityDto {
  @ApiProperty({ enum: OPPORTUNITY_STATUSES, example: 'QUALIFIED' })
  @IsIn(OPPORTUNITY_STATUSES)
  status: OpportunityStatus;

  @ApiPropertyOptional({ description: 'Captured when moving to LOST.' })
  @IsOptional()
  @IsString()
  lossReason?: string;
}
