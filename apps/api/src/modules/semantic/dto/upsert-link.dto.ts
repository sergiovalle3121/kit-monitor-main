import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const CARDINALITIES = [
  'one_to_one',
  'one_to_many',
  'many_to_one',
  'many_to_many',
];

export class UpsertLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fromObject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  toObject: string;

  @IsOptional()
  @IsIn(CARDINALITIES)
  cardinality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  verb?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
