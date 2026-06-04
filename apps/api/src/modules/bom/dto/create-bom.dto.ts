import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsDateString, ValidateNested, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BomStatus } from '../entities/bom-header.entity';

export class CreateBomComponentDto {
  @IsString()
  componentNumber: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  usageFactor?: number;

  @IsString()
  @IsOptional()
  referenceDesignator?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  standardCost?: number;

  @IsBoolean()
  @IsOptional()
  isPhantom?: boolean;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsNumber()
  @IsOptional()
  level?: number;
}

export class CreateBomHeaderDto {
  @IsString()
  model: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  revision?: string;

  @IsEnum(BomStatus)
  @IsOptional()
  status?: BomStatus;

  @IsString()
  @IsOptional()
  bomType?: string;

  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  baseQuantity?: number;

  @IsString()
  @IsOptional()
  baseUnit?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomComponentDto)
  @IsOptional()
  components?: CreateBomComponentDto[];
}
