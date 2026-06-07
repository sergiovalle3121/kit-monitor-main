import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TestResult,
  TestStationType,
} from '../entities/test-record.entity';

const STATIONS = ['ICT', 'FCT', 'AOI', 'FINAL', 'OTHER'];
const RESULTS = ['PASS', 'FAIL'];

export class CreateTestRecordDto {
  @ApiProperty({ example: 'SN-000123' })
  @IsString()
  @Length(1, 80)
  serialNumber: string;

  @ApiProperty({ enum: RESULTS, example: 'PASS' })
  @IsIn(RESULTS)
  result: TestResult;

  @ApiPropertyOptional({ enum: STATIONS, example: 'FCT' })
  @IsOptional()
  @IsIn(STATIONS)
  station?: TestStationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  model?: string;

  @ApiPropertyOptional({ example: 'F-101', description: 'Código de falla (si FAIL).' })
  @IsOptional()
  @IsString()
  @Length(0, 48)
  failureCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  failureDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ example: '2026-06-07T15:00:00Z' })
  @IsOptional()
  @IsString()
  testedAt?: string;
}
