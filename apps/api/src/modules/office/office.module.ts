import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeDocument } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeService } from './office.service';
import { OfficeController } from './office.controller';
import { OfficeSheetConnectorsService } from './office-sheet-connectors.service';

@Module({
  imports: [TypeOrmModule.forFeature([OfficeDocument, OfficeDocumentVersion])],
  controllers: [OfficeController],
  providers: [OfficeService, OfficeSheetConnectorsService],
  exports: [OfficeService],
})
export class OfficeModule {}
