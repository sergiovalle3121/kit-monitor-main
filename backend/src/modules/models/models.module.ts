import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';
import { Model } from './entities/model.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Model])],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}