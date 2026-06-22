import {
  IsBoolean,
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

const LABOR_TYPES = ['DIRECT', 'INDIRECT'] as const;
const EMPLOYMENT_TYPES = ['FULL_TIME', 'TEMP', 'CONTRACTOR', 'INTERN'] as const;
const POTENTIAL = ['LOW', 'MED', 'HIGH'] as const;

// ── Employees ────────────────────────────────────────────────────────────────

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @Length(1, 120)
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @Length(1, 120)
  lastName: string;

  @ApiPropertyOptional({ example: 'EMP-1042' })
  @IsOptional()
  @IsString()
  @Length(0, 40)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  email?: string;

  @ApiPropertyOptional({ example: 'Operador SMT' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  position?: string;

  @ApiPropertyOptional({ example: 'SMT' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional({ example: 'Producción' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  department?: string;

  @ApiPropertyOptional({ example: 'CC-500' })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  costCenter?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  shift?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  station?: string;

  @ApiPropertyOptional({ enum: LABOR_TYPES })
  @IsOptional()
  @IsIn([...LABOR_TYPES])
  laborType?: (typeof LABOR_TYPES)[number];

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn([...EMPLOYMENT_TYPES])
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @IsString()
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'F' })
  @IsOptional()
  @IsString()
  @Length(0, 16)
  gender?: string;

  @ApiPropertyOptional({ description: 'Costo mensual cargado (MXN).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  supervisorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  managerEmployeeNumber?: string;

  @ApiPropertyOptional({ description: 'Engagement 0..100.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementScore?: number;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  costCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  shift?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  line?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  station?: string;

  @ApiPropertyOptional({ enum: LABOR_TYPES })
  @IsOptional()
  @IsIn([...LABOR_TYPES])
  laborType?: (typeof LABOR_TYPES)[number];

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ON_LEAVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ON_LEAVE'])
  status?: 'ACTIVE' | 'ON_LEAVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  supervisorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementScore?: number;
}

export class TerminateEmployeeDto {
  @ApiProperty({ enum: ['VOLUNTARY', 'INVOLUNTARY'] })
  @IsIn(['VOLUNTARY', 'INVOLUNTARY'])
  terminationType: 'VOLUNTARY' | 'INVOLUNTARY';

  @ApiPropertyOptional({ example: 'Mejor oferta' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsString()
  terminationDate?: string;
}

// ── Requisitions ─────────────────────────────────────────────────────────────

export class CreateRequisitionDto {
  @ApiProperty({ example: 'Operador SMT (turno B)' })
  @IsString()
  @Length(2, 160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  costCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  shift?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  line?: string;

  @ApiPropertyOptional({ enum: LABOR_TYPES })
  @IsOptional()
  @IsIn([...LABOR_TYPES])
  laborType?: (typeof LABOR_TYPES)[number];

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  openings?: number;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ enum: ['GROWTH', 'REPLACEMENT', 'RAMP'] })
  @IsOptional()
  @IsIn(['GROWTH', 'REPLACEMENT', 'RAMP'])
  reason?: 'GROWTH' | 'REPLACEMENT' | 'RAMP';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  program?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  customer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  hiringManager?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetFillDate?: string;
}

export class UpdateRequisitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  openings?: number;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  hiringManager?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetFillDate?: string;
}

export class TransitionRequisitionDto {
  @ApiProperty({ enum: ['OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED'] })
  @IsIn(['OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED'])
  to: 'OPEN' | 'ON_HOLD' | 'FILLED' | 'CANCELLED';
}

// ── Candidates ───────────────────────────────────────────────────────────────

export class CreateCandidateDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  requisitionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @ApiPropertyOptional({
    enum: ['REFERRAL', 'JOB_BOARD', 'WALK_IN', 'AGENCY', 'INTERNAL', 'SOCIAL', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['REFERRAL', 'JOB_BOARD', 'WALK_IN', 'AGENCY', 'INTERNAL', 'SOCIAL', 'OTHER'])
  source?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdvanceCandidateDto {
  @ApiProperty({
    enum: ['SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'],
  })
  @IsIn(['SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'])
  to: 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';

  @ApiPropertyOptional({ description: 'Al contratar (HIRED): crear el colaborador.' })
  @IsOptional()
  @IsBoolean()
  createEmployee?: boolean;
}

// ── Performance reviews ──────────────────────────────────────────────────────

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  employeeName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  department?: string;

  @ApiProperty({ example: '2026-H1' })
  @IsString()
  @Length(2, 16)
  period: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  reviewer?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  performanceScore?: number;

  @ApiPropertyOptional({ enum: POTENTIAL })
  @IsOptional()
  @IsIn([...POTENTIAL])
  potential?: (typeof POTENTIAL)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  goalsMetPct?: number;

  @ApiPropertyOptional({ enum: ['READY_NOW', 'ONE_TWO_YEARS', 'NOT_READY'] })
  @IsOptional()
  @IsIn(['READY_NOW', 'ONE_TWO_YEARS', 'NOT_READY'])
  successionReadiness?: 'READY_NOW' | 'ONE_TWO_YEARS' | 'NOT_READY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  performanceScore?: number;

  @ApiPropertyOptional({ enum: POTENTIAL })
  @IsOptional()
  @IsIn([...POTENTIAL])
  potential?: (typeof POTENTIAL)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  goalsMetPct?: number;

  @ApiPropertyOptional({ enum: ['READY_NOW', 'ONE_TWO_YEARS', 'NOT_READY'] })
  @IsOptional()
  @IsIn(['READY_NOW', 'ONE_TWO_YEARS', 'NOT_READY'])
  successionReadiness?: 'READY_NOW' | 'ONE_TWO_YEARS' | 'NOT_READY';

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'CALIBRATED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'CALIBRATED', 'CLOSED'])
  status?: 'DRAFT' | 'SUBMITTED' | 'CALIBRATED' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

// ── Absences ─────────────────────────────────────────────────────────────────

export class CreateAbsenceDto {
  @ApiProperty()
  @IsString()
  @Length(2, 160)
  employeeName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  employeeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  shift?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  line?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ enum: ['ABSENCE', 'LATE', 'SICK', 'VACATION', 'PERMIT', 'SUSPENSION'] })
  @IsOptional()
  @IsIn(['ABSENCE', 'LATE', 'SICK', 'VACATION', 'PERMIT', 'SUSPENSION'])
  type?: 'ABSENCE' | 'LATE' | 'SICK' | 'VACATION' | 'PERMIT' | 'SUSPENSION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  justified?: boolean;

  @ApiPropertyOptional({ description: 'Horas perdidas.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}
