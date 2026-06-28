import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeDocument } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeComment } from './entities/office-comment.entity';
import { OfficeDocumentComment } from './entities/office-document-comment.entity';
import { OfficeService } from './office.service';
import { OfficeController } from './office.controller';
import { OfficeSheetConnectorsService } from './office-sheet-connectors.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [TypeOrmModule.forFeature([OfficeDocument, OfficeDocumentVersion, OfficeComment, OfficeDocumentComment]), GovernanceModule],
  controllers: [OfficeController],
  providers: [OfficeService, OfficeSheetConnectorsService],
  exports: [OfficeService],
})
export class OfficeModule {}
