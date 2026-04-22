import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '3312793' })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({ example: '31218223' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
