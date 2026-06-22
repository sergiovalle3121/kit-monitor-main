import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type {
  AccountStatus,
  AccountTier,
  AccountType,
  RiskLevel,
} from '../entities/crm-account.entity';

const TYPES: AccountType[] = ['CUSTOMER', 'PROSPECT', 'PARTNER', 'INACTIVE'];
const TIERS: AccountTier[] = ['STRATEGIC', 'A', 'B', 'C'];
const STATUSES: AccountStatus[] = ['ACTIVE', 'ON_HOLD', 'INACTIVE'];
const RISKS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

export class CreateAccountDto {
  @ApiProperty({ example: 'Axos Mobility' })
  @IsString()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional({ example: 'AX-MOBILITY' })
  @IsOptional()
  @IsString()
  @Length(2, 40)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  legalName?: string;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: AccountType;

  @ApiPropertyOptional({ enum: TIERS })
  @IsOptional()
  @IsIn(TIERS)
  tier?: AccountTier;

  @ApiPropertyOptional({ enum: RISKS })
  @IsOptional()
  @IsIn(RISKS)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  segment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'NAM' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'NET30' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 'DAP' })
  @IsOptional()
  @IsString()
  incoterm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRevenue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  employees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duns?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  enterpriseCustomerCode?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  healthScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  npsScore?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: AccountStatus;
}
