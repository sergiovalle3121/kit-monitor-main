import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateModelDto {
  @ApiProperty({ example: 'Advanced Pro 3000' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @ApiProperty({ example: 'Professional grade monitoring kit' })
  @IsString()
  @Length(10, 500)
  description: string;
}