import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SHIPMENT_STATUSES } from '../shipment-state';
import type { ShipmentStatus } from '../shipment-state';
import type { Incoterm } from '../entities/shipment.entity';

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP', 'DDP', 'OTHER'];

export class CreateShipmentDto {
  @ApiProperty({ example: 'PT Modelo X — 500 pzs' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  destination?: string;

  @ApiPropertyOptional({ enum: INCOTERMS })
  @IsOptional()
  @IsIn(INCOTERMS)
  incoterm?: Incoterm;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  carrier?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  packageCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @IsString()
  promisedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  destination?: string;

  @ApiPropertyOptional({ enum: INCOTERMS })
  @IsOptional()
  @IsIn(INCOTERMS)
  incoterm?: Incoterm;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  packageCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promisedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Assign transport (carrier/unit/driver/dock) to a shipment. All optional so
 * traffic can fill it incrementally; the service validates each provided piece
 * against the assignment poka-yoke before tying it to the shipment.
 */
export class AssignTransportDto {
  @ApiPropertyOptional({ description: 'Transportista (traffic_carriers.id).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  carrierId?: string;

  @ApiPropertyOptional({ description: 'Unidad (traffic_vehicles.id).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Chofer (traffic_drivers.id).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  driverId?: string;

  @ApiPropertyOptional({ description: 'Andén (traffic_docks.id).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  dockId?: string;
}

export class TransitionShipmentDto {
  @ApiProperty({ enum: SHIPMENT_STATUSES, example: 'SHIPPED' })
  @IsIn(SHIPMENT_STATUSES)
  status: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Número de guía (al embarcar).' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Carrier (al embarcar).' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  carrier?: string;
}
