import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import type {
  BuyingRole,
  ContactDepartment,
} from '../entities/crm-contact.entity';

const DEPARTMENTS: ContactDepartment[] = [
  'PROCUREMENT', 'ENGINEERING', 'QUALITY', 'EXECUTIVE',
  'SUPPLY_CHAIN', 'FINANCE', 'OPERATIONS', 'OTHER',
];
const ROLES: BuyingRole[] = [
  'DECISION_MAKER', 'INFLUENCER', 'CHAMPION', 'USER', 'GATEKEEPER',
];

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @Length(1, 36)
  accountId: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: DEPARTMENTS })
  @IsOptional()
  @IsIn(DEPARTMENTS)
  department?: ContactDepartment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  buyingRole?: BuyingRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
