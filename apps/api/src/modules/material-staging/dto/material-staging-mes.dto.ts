import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Carril 1: marcar una línea del pick-list como surtida (staged). */
export class StagePlanLineDto {
  @ApiPropertyOptional({
    example: 50,
    description:
      'Cantidad surtida; si se omite, se usa el requerido del pick-list.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stagedQty?: number;
}
