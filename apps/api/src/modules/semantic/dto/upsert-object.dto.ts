import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertObjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceEntity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  primaryKey?: string;

  /** Salient properties (attributes). Validated loosely; sanitized in service. */
  @IsOptional()
  @IsArray()
  properties?: { name: string; type: string; description?: string }[];
}
