import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisualAid } from './entities/visual-aid.entity';
import { VisualAidsController } from './visual-aids.controller';
import { VisualAidsService } from './visual-aids.service';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VisualAid, EnterpriseProgram])],
  controllers: [VisualAidsController],
  providers: [VisualAidsService],
  exports: [VisualAidsService],
})
export class VisualAidsModule {}
