import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BayLayout } from './entities/bay-layout.entity';
import { BayLayoutService } from './bay-layout.service';
import { BayLayoutController } from './bay-layout.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BayLayout])],
  controllers: [BayLayoutController],
  providers: [BayLayoutService],
  exports: [BayLayoutService],
})
export class BayLayoutModule {}
