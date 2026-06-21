import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UnitTestResult } from '../unit-flow-stage';

/**
 * Manual hand-off into the test queue. The automatic path is the MES hook
 * (a serial confirmed at the final assembly station); this endpoint exists for
 * manual ops, backfills and demos without driving a full MES execution.
 */
export class EnqueueUnitDto {
  @ApiProperty({ example: 'SN-000123' })
  @IsString()
  @Length(1, 80)
  serialNumber: string;

  @ApiPropertyOptional({ example: 'WO-2026-0001' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  workOrder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  executionId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  model?: string;

  @ApiPropertyOptional({ example: 'EST-FINAL' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;
}

/** Internal input used by the MES hook to queue a finished serial for test. */
export interface EnqueueFromAssemblyInput {
  serialNumber: string;
  workOrder?: string | null;
  executionId?: number | null;
  model?: string | null;
  station?: string | null;
  programId?: string | null;
}

/** Internal input used by the testing hook to route a serial by its result. */
export interface RouteFromTestInput {
  serialNumber: string;
  result: UnitTestResult;
  model?: string | null;
  failureCode?: string | null;
  failureDescription?: string | null;
  station?: string | null;
  testRecordId?: string | null;
  programId?: string | null;
}
