import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAINTENANCE_ORDER_STATUSES } from '../order-state';
import type { MaintenanceOrderStatus } from '../order-state';
import type {
  AssetCriticality,
  AssetStatus,
} from '../entities/asset.entity';
import type {
  MaintenancePriority,
  MaintenanceType,
} from '../entities/maintenance-order.entity';
import { PM_FREQUENCY_TYPES } from '../pm-frequency';
import type { PmFrequencyType } from '../entities/pm-plan.entity';

const CRITICALITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ASSET_STATUSES = ['RUNNING', 'DOWN', 'IDLE', 'RETIRED'];
const MO_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

export class CreateAssetDto {
  @ApiProperty({ example: 'Horno de reflujo SMT-1' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({ example: 'EQ-SMT-001' })
  @IsOptional()
  @IsString()
  @Length(0, 48)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  location?: string;

  @ApiPropertyOptional({ enum: CRITICALITIES })
  @IsOptional()
  @IsIn(CRITICALITIES)
  criticality?: AssetCriticality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  serialNumber?: string;
}

export class UpdateAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  location?: string;

  @ApiPropertyOptional({ enum: CRITICALITIES })
  @IsOptional()
  @IsIn(CRITICALITIES)
  criticality?: AssetCriticality;

  @ApiPropertyOptional({ enum: ASSET_STATUSES })
  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: AssetStatus;
}

export class CreateMaintenanceOrderDto {
  @ApiProperty({ example: 'Cambiar termopar zona 3' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MO_TYPES, example: 'CORRECTIVE' })
  @IsOptional()
  @IsIn(MO_TYPES)
  type?: MaintenanceType;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: MaintenancePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  assignedTo?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class UpdateMaintenanceOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MO_TYPES })
  @IsOptional()
  @IsIn(MO_TYPES)
  type?: MaintenanceType;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: MaintenancePriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class TransitionMaintenanceOrderDto {
  @ApiProperty({ enum: MAINTENANCE_ORDER_STATUSES, example: 'IN_PROGRESS' })
  @IsIn(MAINTENANCE_ORDER_STATUSES)
  status: MaintenanceOrderStatus;

  @ApiPropertyOptional({ description: 'Minutos de paro (al completar).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  downtimeMinutes?: number;
}

// ── Preventive-maintenance plans (PM) ────────────────────────────────────────

export class CreatePmPlanDto {
  @ApiProperty({ example: 'Lubricación y limpieza de rieles' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Activo al que aplica el preventivo.' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  assetId?: string;

  @ApiProperty({ enum: PM_FREQUENCY_TYPES, example: 'DAYS' })
  @IsIn(PM_FREQUENCY_TYPES)
  frequencyType: PmFrequencyType;

  @ApiProperty({ example: 30, description: 'Cada N días/semanas/meses.' })
  @IsInt()
  @Min(1)
  @Max(3650)
  frequencyValue: number;

  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Última realización; si se omite arranca desde hoy.',
  })
  @IsOptional()
  @IsString()
  lastDoneDate?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Próximo vencimiento explícito; si se omite se calcula.',
  })
  @IsOptional()
  @IsString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  assignedTo?: string;
}

export class UpdatePmPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PM_FREQUENCY_TYPES })
  @IsOptional()
  @IsIn(PM_FREQUENCY_TYPES)
  frequencyType?: PmFrequencyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  frequencyValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastDoneDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Pausar/reactivar el plan.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
