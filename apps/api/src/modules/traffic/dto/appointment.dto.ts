import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { APPOINTMENT_DIRECTIONS } from '../traffic-appointment.rules';
import type { AppointmentDirection } from '../traffic-appointment.rules';

export class CreateAppointmentDto {
  @ApiProperty({ example: '2026-06-24T14:00:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ example: '2026-06-24T15:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @ApiPropertyOptional({ enum: APPOINTMENT_DIRECTIONS })
  @IsOptional()
  @IsIn(APPOINTMENT_DIRECTIONS)
  direction?: AppointmentDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  dockId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Folio o id del embarque outbound (referencia).',
  })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  shipmentRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  windowEnd?: string;

  @ApiPropertyOptional({ enum: APPOINTMENT_DIRECTIONS })
  @IsOptional()
  @IsIn(APPOINTMENT_DIRECTIONS)
  direction?: AppointmentDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  dockId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  shipmentRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
