import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class OfficeCommentAnchorDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  from?: number;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @IsInt()
  @Min(0)
  to?: number;
}

export class CreateOfficeCommentDto {
  @ApiPropertyOptional({ example: 'cm_lx9z3_ab12' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  anchorId?: string;

  @ApiProperty({ example: 'Revisar torque antes de liberar.' })
  @IsString()
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional({ example: 'Torque specification' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  quotedText?: string;

  @ApiPropertyOptional({ type: OfficeCommentAnchorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfficeCommentAnchorDto)
  anchor?: OfficeCommentAnchorDto;

  @ApiPropertyOptional({ type: [String], example: ['quality@axos.local'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  mentions?: string[];

  @ApiPropertyOptional({ example: 'quality@axos.local' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedTo?: string;
}

export class UpdateOfficeCommentDto {
  @ApiPropertyOptional({ example: 'Actualizar especificación de torque.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional({ type: OfficeCommentAnchorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OfficeCommentAnchorDto)
  anchor?: OfficeCommentAnchorDto;

  @ApiPropertyOptional({ example: 'Torque specification' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  quotedText?: string;

  @ApiPropertyOptional({ type: [String], example: ['quality@axos.local'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  mentions?: string[];

  @ApiPropertyOptional({ example: 'quality@axos.local', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedTo?: string | null;
}

export class ReplyOfficeCommentDto {
  @ApiProperty({ example: 'Revisar torque antes de liberar.' })
  @IsString()
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional({ type: [String], example: ['quality@axos.local'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  mentions?: string[];
}

export class ListOfficeCommentsQueryDto {
  @ApiPropertyOptional({ example: 'false' })
  @IsOptional()
  @IsString()
  includeResolved?: string;

  @ApiPropertyOptional({ enum: ['all', 'open', 'resolved'] })
  @IsOptional()
  @IsString()
  status?: 'all' | 'open' | 'resolved';

  @ApiPropertyOptional({ example: 'quality@axos.local' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedTo?: string;

  @ApiPropertyOptional({ example: 'quality@axos.local' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mention?: string;

  @ApiPropertyOptional({ example: 'author@axos.local' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  author?: string;

  @ApiPropertyOptional({ example: 'torque' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
