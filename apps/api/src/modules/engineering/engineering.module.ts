import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineeringDocument } from './entities/engineering-document.entity';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EngineeringDocument])],
  controllers: [EngineeringController],
  providers: [EngineeringService],
  exports: [EngineeringService],
})
export class EngineeringModule {}
