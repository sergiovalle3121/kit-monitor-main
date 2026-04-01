import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateKitDto } from './create-kit.dto';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateKitDto extends PartialType(CreateKitDto) {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  modelId?: number;
}