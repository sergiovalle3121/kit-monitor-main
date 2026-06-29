import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeDocument } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeComment } from './entities/office-comment.entity';
import { OfficeDocumentComment } from './entities/office-document-comment.entity';
import { OfficeDocumentSearchIndex } from './entities/office-document-search-index.entity';
import { OfficeDocumentDistribution } from './entities/office-document-distribution.entity';
import { OfficeDocumentSignature } from './entities/office-document-signature.entity';
import { OfficeDocumentTrainingAssignment } from './entities/office-document-training.entity';
import { OfficeDocumentReviewTask } from './entities/office-document-review-task.entity';
import { OfficeService } from './office.service';
import { OfficeController } from './office.controller';
import { OfficeSheetConnectorsService } from './office-sheet-connectors.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfficeDocument,
      OfficeDocumentVersion,
      OfficeComment,
      OfficeDocumentComment,
      OfficeDocumentSearchIndex,
      OfficeDocumentDistribution,
      OfficeDocumentSignature,
      OfficeDocumentTrainingAssignment,
      OfficeDocumentReviewTask,
    ]),
    GovernanceModule,
  ],
  controllers: [OfficeController],
  providers: [OfficeService, OfficeSheetConnectorsService],
  exports: [OfficeService],
})
export class OfficeModule {}
