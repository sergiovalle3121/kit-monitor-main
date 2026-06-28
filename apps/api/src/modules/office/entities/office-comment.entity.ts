import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OfficeCommentAnchorType =
  | 'document'
  | 'slide'
  | 'object'
  | 'cell'
  | 'range'
  | 'text'
  | 'sheet'
  | 'table'
  | 'pivot'
  | 'chart';

/**
 * Persistent enterprise review thread for Office documents.
 *
 * Comments are tenant-scoped and anchored generically so Docs, Sheets and Slides
 * can share the same backend model. Replies are represented by `parentId`.
 */
@Entity('office_comments')
@Index('idx_office_comments_doc_anchor', [
  'documentId',
  'anchorType',
  'slideIndex',
])
@Index('idx_office_comments_tenant_doc', ['tenantId', 'documentId'])
export class OfficeComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  documentId: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'tenant_id', type: 'varchar', length: 64, nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  authorEmail: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  assignedTo: string | null;

  @Column({ type: 'varchar', length: 24, default: 'document' })
  anchorType: OfficeCommentAnchorType;

  @Column({ type: 'int', nullable: true })
  slideIndex: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  objectId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  rangeRef: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  anchorLabel: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
