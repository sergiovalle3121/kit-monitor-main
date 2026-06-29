import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type OfficeDistributionAction = 'export' | 'print' | 'download' | 'controlled_copy';
export type OfficeDistributionFormat = 'pdf' | 'docx' | 'html' | 'markdown' | 'txt' | 'print' | 'other';

/** Audit-ready ledger of document outputs distributed outside AXOS Docs. */
@Entity('office_document_distributions')
export class OfficeDocumentDistribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'document_id' })
  @Index()
  documentId: string;

  @Column({ type: 'varchar', length: 32 })
  action: OfficeDistributionAction;

  @Column({ type: 'varchar', length: 24 })
  format: OfficeDistributionFormat;

  @Column({ type: 'int', name: 'copy_no' })
  copyNo: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  recipient: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  actor: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
