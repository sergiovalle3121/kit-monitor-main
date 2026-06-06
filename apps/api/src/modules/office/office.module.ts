import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeDocument } from './entities/office-document.entity';
import { OfficeService } from './office.service';
import { OfficeController } from './office.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OfficeDocument])],
  controllers: [OfficeController],
  providers: [OfficeService],
  exports: [OfficeService],
})
export class OfficeModule {}
