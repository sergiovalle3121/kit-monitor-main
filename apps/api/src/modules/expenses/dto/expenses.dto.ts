import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXPENSE_STATUSES } from '../expense-state';
import type { ExpenseStatus } from '../expense-state';
import type { ExpenseCategory } from '../entities/expense-report.entity';

const CATEGORIES = ['TRAVEL', 'MEALS', 'LODGING', 'SUPPLIES', 'TRAINING', 'OTHER'];

export class CreateExpenseDto {
  @ApiProperty({ example: 'Vuelo a planta Guadalajara' })
  @IsString()
  @Length(3, 200)
  description: string;

  @ApiProperty({ example: 4500 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  employeeName?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ example: '2026-06-05' })
  @IsOptional()
  @IsString()
  expenseDate?: string;
}

export class TransitionExpenseDto {
  @ApiProperty({ enum: EXPENSE_STATUSES, example: 'SUBMITTED' })
  @IsIn(EXPENSE_STATUSES)
  status: ExpenseStatus;

  @ApiPropertyOptional({ description: 'Motivo de rechazo (al rechazar).' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  rejectReason?: string;
}
