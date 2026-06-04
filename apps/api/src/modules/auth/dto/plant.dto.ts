import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreatePlantDto {
  @ApiProperty({ example: 'Planta Norte' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Monterrey, NL' })
  @IsNotEmpty()
  @IsString()
  location: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsUUID()
  tenantId: string;
}

export class UpdatePlantDto {
  @ApiProperty({ example: 'Planta Norte', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Monterrey, NL', required: false })
  @IsOptional()
  @IsString()
  location?: string;
}
