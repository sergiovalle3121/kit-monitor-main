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
