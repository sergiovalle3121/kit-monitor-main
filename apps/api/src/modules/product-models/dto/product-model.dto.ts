import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PRODUCT_MODEL_STATUSES } from '../product-model-state';
import type { ProductModelStatus } from '../product-model-state';

export class CreateProductModelDto {
  @ApiProperty({ example: 'Controlador EV — Gen 2' })
  @IsString()
  @Length(2, 200)
  name: string;

  @ApiPropertyOptional({
    description:
      'Número del modelo. Si se omite, se asigna un folio MDL- automáticamente.',
    example: 'MDL-00001',
  })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  modelNumber?: string;

  @ApiPropertyOptional({ example: 'ACME Robotics' })
  @IsOptional()
  @IsString()
  @Length(0, 160)
  customer?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  revision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Programa/cuenta asociada.' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional({
    description: 'Datos libres: cliente, programa, notas, atributos.',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateProductModelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 160)
  customer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  revision?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class TransitionProductModelDto {
  @ApiProperty({ enum: PRODUCT_MODEL_STATUSES, example: 'ACTIVE' })
  @IsIn(PRODUCT_MODEL_STATUSES)
  status: ProductModelStatus;
}
