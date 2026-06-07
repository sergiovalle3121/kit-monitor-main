import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONTRACT_STATUSES } from '../contract-state';
import type { ContractStatus } from '../contract-state';
import type { ContractType } from '../entities/contract.entity';

const TYPES = ['CUSTOMER', 'SUPPLIER', 'NDA', 'LEASE', 'SERVICE', 'OTHER'];

export class CreateContractDto {
  @ApiProperty({ example: 'Acuerdo de suministro EMS — Cliente A' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  counterparty?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: ContractType;

  @ApiPropertyOptional({ example: 1200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContractDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  counterparty?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: ContractType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransitionContractDto {
  @ApiProperty({ enum: CONTRACT_STATUSES, example: 'ACTIVE' })
  @IsIn(CONTRACT_STATUSES)
  status: ContractStatus;

  @ApiPropertyOptional({ description: 'Nueva fecha de fin (al renovar).' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
