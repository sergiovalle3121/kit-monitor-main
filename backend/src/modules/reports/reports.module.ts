import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { User } from '../users/entities/user.entity';
import { Model } from '../models/entities/model.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, User, Model]), // <--- Aquí agregas las 3 entidades
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService], // solo si necesitas exportar
})
export class ReportsModule {}
