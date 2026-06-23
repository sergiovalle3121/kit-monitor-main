import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCertificationDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @Length(2, 160)
  employeeName: string;

  @ApiPropertyOptional({
    description:
      'Id del colaborador en hr_employees (liga a empleado real). Opcional para datos viejos.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  employeeId?: string;

  @ApiProperty({ example: 'Soldadura IPC-J-STD-001' })
  @IsString()
  @Length(2, 160)
  skill: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  employeeEmail?: string;

  @ApiPropertyOptional({ example: 'SMT' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional({ example: 'SMT-1' })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  certifiedBy?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsString()
  issuedDate?: string;

  @ApiPropertyOptional({ example: '2027-01-15' })
  @IsOptional()
  @IsString()
  expiresDate?: string;
}

export class UpdateCertificationDto {
  @ApiPropertyOptional({ description: 'Re-liga la certificación a un colaborador real.' })
  @IsOptional()
  @IsString()
  @Length(0, 36)
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  employeeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  employeeEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 160)
  skill?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  station?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  certifiedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuedDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de expiración (recertificación).' })
  @IsOptional()
  @IsString()
  expiresDate?: string;
}
