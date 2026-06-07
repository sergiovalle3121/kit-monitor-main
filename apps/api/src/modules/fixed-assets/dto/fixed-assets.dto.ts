import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFixedAssetDto {
  @ApiProperty({ example: 'Línea SMT Fuji NXT III' })
  @IsString()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  category?: string;

  @ApiProperty({ example: 1200000 })
  @IsNumber()
  @Min(0)
  acquisitionCost: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salvageValue?: number;

  @ApiProperty({ example: 84, description: 'Vida útil en meses.' })
  @IsInt()
  @Min(1)
  usefulLifeMonths: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

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

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsString()
  acquisitionDate?: string;
}

export class DisposeFixedAssetDto {
  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  disposedAt?: string;
}
