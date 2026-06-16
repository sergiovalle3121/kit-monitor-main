import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Record one genealogy link (the forward "populated by event" hook): a built
 * serial consumed a lot/reel of a part. Idempotent by `idempotencyKey` (or a
 * deterministic key derived from serial+part+lot+reel+sourceEventId).
 */
export class RecordLinkDto {
  @ApiProperty({ description: 'Serial de la unidad construida (padre del árbol).' })
  @IsString()
  @Length(1, 80)
  builtSerial: string;

  @ApiProperty({ description: 'Número de parte (NP) consumido.' })
  @IsString()
  @Length(1, 64)
  part: string;

  @ApiPropertyOptional({ description: 'Lote del material consumido.' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  lot?: string;

  @ApiPropertyOptional({ description: 'Reel / feeder del material consumido.' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  reel?: string;

  @ApiPropertyOptional({ description: 'Sub-ensamble: serial padre donde entra esta unidad.' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  parentSerial?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 36)
  woId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  woFolio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  model?: string;

  @ApiPropertyOptional({ example: 'EST-10' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  operatorEmail?: string;

  @ApiPropertyOptional({ description: 'Marca de tiempo del consumo (ISO).' })
  @IsOptional()
  @IsISO8601()
  consumedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({ description: 'Id del evento de consumo origen (para idempotencia).' })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  sourceEventId?: string;

  @ApiPropertyOptional({ description: 'Clave de idempotencia explícita.' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  idempotencyKey?: string;
}

/** Link a built serial to the shipment that contains it (the recall "tomb" side). */
export class LinkShipmentDto {
  @ApiProperty({ description: 'Serial de la unidad embarcada.' })
  @IsString()
  @Length(1, 80)
  builtSerial: string;

  @ApiPropertyOptional({ description: 'Id del embarque (outbound_shipments.id).' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  shipmentFolio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 32)
  asn?: string;

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

  @ApiPropertyOptional({ description: 'Fecha de embarque (ISO).' })
  @IsOptional()
  @IsISO8601()
  shippedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  idempotencyKey?: string;
}
