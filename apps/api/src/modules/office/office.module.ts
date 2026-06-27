import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficeDocument } from './entities/office-document.entity';
import { OfficeDocumentVersion } from './entities/office-document-version.entity';
import { OfficeDocumentComment } from './entities/office-document-comment.entity';
import { OfficeService } from './office.service';
import { OfficeController } from './office.controller';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [TypeOrmModule.forFeature([OfficeDocument, OfficeDocumentVersion, OfficeDocumentComment]), GovernanceModule],
  controllers: [OfficeController],
  providers: [OfficeService],
  exports: [OfficeService],
})
export class OfficeModule {}
