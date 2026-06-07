import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStationDto {
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

  @ApiProperty({ example: 'EST-10' })
  @IsString()
  @Length(1, 32)
  station: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiPropertyOptional({ example: 'CAP-0402-100NF', description: 'Expected NP (poka-yoke).' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  npExpected?: string;

  @ApiPropertyOptional({ example: 2, description: 'Qty per unit (supports fractions).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  useFactor?: number;

  @ApiPropertyOptional({ example: 45, description: 'Standard time per unit (sec).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stdTimeSec?: number;

  @ApiPropertyOptional({ example: 'F-12' })
  @IsOptional()
  @IsString()
  @Length(0, 48)
  feederPosition?: string;

  @ApiPropertyOptional({ example: 'https://aids.axos/np/cap-0402.pdf' })
  @IsOptional()
  @IsString()
  @Length(0, 512)
  visualAidUrl?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  ctq?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class UpdateStationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  npExpected?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  useFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stdTimeSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 48)
  feederPosition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 512)
  visualAidUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ctq?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QualifyModelLineDto {
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

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeoverMinutes?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taktTargetSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}

export class UpdateModelLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeoverMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taktTargetSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}
