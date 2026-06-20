import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewBackflushDto {
  @ApiProperty({ description: 'UUID del ruteo.' })
  @IsString()
  routingId: string;

  @ApiProperty({ description: 'UUID de la operación.' })
  @IsString()
  operationId: string;

  @ApiProperty({ example: 10, description: 'Unidades producidas en la operación.' })
  @IsInt()
  @Min(0)
  units: number;
}

export class CommitBackflushDto extends PreviewBackflushDto {
  @ApiProperty({ description: 'Almacén origen del que se consume.' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'Ubicación (rack/bin); default BULK.' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Orden de trabajo / referencia para el ledger.' })
  @IsOptional()
  @IsString()
  workOrder?: string;
}
