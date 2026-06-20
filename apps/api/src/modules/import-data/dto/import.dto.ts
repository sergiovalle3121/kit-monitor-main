import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IMPORT_SOURCES,
  IMPORT_TARGETS,
  type ImportSource,
  type ImportTarget,
} from '../import-logic';

export class PreviewImportDto {
  @ApiProperty({ enum: IMPORT_SOURCES })
  @IsIn(IMPORT_SOURCES)
  source: ImportSource;

  @ApiProperty({ enum: IMPORT_TARGETS })
  @IsIn(IMPORT_TARGETS)
  target: ImportTarget;

  @ApiPropertyOptional({
    description:
      'Filas crudas (objetos por encabezado). Para CSV/Excel el frontend las parsea; ' +
      'para SQL_STAGING vienen de la tabla de staging. Para IDOC_API se ignoran (las trae el adaptador).',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  rows?: Record<string, any>[];

  @ApiProperty({
    description: 'Mapeo campo destino → encabezado de origen.',
    example: { partNumber: 'Part Number', description: 'Desc' },
  })
  @IsObject()
  mapping: Record<string, string>;

  @ApiPropertyOptional({ description: 'Config del feed externo (IDOC_API).' })
  @IsOptional()
  @IsObject()
  feedConfig?: Record<string, any>;
}

export class CommitImportDto extends PreviewImportDto {
  @ApiPropertyOptional({
    description:
      'En BOM/Routing: crea materiales stub (DRAFT) para partes que no existan en el maestro. ' +
      'Si es false, las partes faltantes se reportan como error de fila.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  createMissingMaterials?: boolean;
}
