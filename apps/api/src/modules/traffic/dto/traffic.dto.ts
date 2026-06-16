import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CARRIER_MODES,
  CARRIER_STATUSES,
  DOCK_STATUSES,
  DOCK_TYPES,
  DRIVER_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from '../traffic.rules';
import type {
  CarrierMode,
  CarrierStatus,
  DockStatus,
  DockType,
  DriverStatus,
  VehicleStatus,
  VehicleType,
} from '../traffic.rules';

// ── Carrier ──────────────────────────────────────────────────────────────────
export class CreateCarrierDto {
  @ApiProperty({ example: 'DHL' })
  @IsString()
  @Length(1, 32)
  code: string;

  @ApiProperty({ example: 'DHL Supply Chain' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional({ enum: CARRIER_MODES })
  @IsOptional()
  @IsIn(CARRIER_MODES)
  mode?: CarrierMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 8)
  scac?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCarrierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional({ enum: CARRIER_MODES })
  @IsOptional()
  @IsIn(CARRIER_MODES)
  mode?: CarrierMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 8)
  scac?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ enum: CARRIER_STATUSES })
  @IsOptional()
  @IsIn(CARRIER_STATUSES)
  status?: CarrierStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Vehicle ──────────────────────────────────────────────────────────────────
export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC-123-Z' })
  @IsString()
  @Length(1, 32)
  plate: string;

  @ApiPropertyOptional({ enum: VEHICLE_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  type?: VehicleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  economicNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxVolumeM3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  vin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 32)
  plate?: string;

  @ApiPropertyOptional({ enum: VEHICLE_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  type?: VehicleType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  economicNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxVolumeM3?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  vin?: string;

  @ApiPropertyOptional({ enum: VEHICLE_STATUSES })
  @IsOptional()
  @IsIn(VEHICLE_STATUSES)
  status?: VehicleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Driver ───────────────────────────────────────────────────────────────────
export class CreateDriverDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @Length(2, 160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 24)
  licenseType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  idDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 24)
  licenseType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  idDocument?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional({ enum: DRIVER_STATUSES })
  @IsOptional()
  @IsIn(DRIVER_STATUSES)
  status?: DriverStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Loading dock ─────────────────────────────────────────────────────────────
export class CreateDockDto {
  @ApiProperty({ example: 'D-04' })
  @IsString()
  @Length(1, 32)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @ApiPropertyOptional({ enum: DOCK_TYPES })
  @IsOptional()
  @IsIn(DOCK_TYPES)
  type?: DockType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  buildingName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDockDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;

  @ApiPropertyOptional({ enum: DOCK_TYPES })
  @IsOptional()
  @IsIn(DOCK_TYPES)
  type?: DockType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  buildingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  buildingName?: string;

  @ApiPropertyOptional({ enum: DOCK_STATUSES })
  @IsOptional()
  @IsIn(DOCK_STATUSES)
  status?: DockStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
