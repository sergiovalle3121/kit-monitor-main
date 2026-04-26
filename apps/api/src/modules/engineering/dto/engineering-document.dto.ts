import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';
import { EngineeringDocumentType } from '../entities/engineering-document.entity';

export class CreateEngineeringDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(EngineeringDocumentType)
  documentType: EngineeringDocumentType;

  @IsOptional()
  @IsObject()
  scope?: any;

  @IsOptional()
  @IsObject()
  viewport?: any;

  @IsOptional()
  @IsString()
  units?: string;

  @IsOptional()
  @IsObject()
  content?: any;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateEngineeringDocumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  scope?: any;

  @IsOptional()
  @IsObject()
  viewport?: any;

  @IsOptional()
  @IsString()
  units?: string;

  @IsOptional()
  @IsObject()
  content?: any;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
