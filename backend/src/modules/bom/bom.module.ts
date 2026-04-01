import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BomItem } from './entities/bom-item.entity';
import { BomService } from './bom.service';
import { BomController } from './bom.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BomItem])],
  controllers: [BomController],
  providers: [BomService],
  exports: [BomService],
})
export class BomModule {}
