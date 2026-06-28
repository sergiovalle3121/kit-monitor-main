import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export interface OfficeCommentReply {
  id: string;
  author: string | null;
  text: string;
  mentions: string[];
  createdAt: string;
}

/** Persistent review thread anchored to a TipTap comment mark inside an Office document. */
@Entity('office_document_comments')
@Index(['tenantId', 'documentId', 'resolved'])
export class OfficeDocumentComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 64, nullable: true })
  tenantId: string | null;

  @Column({ name: 'document_id', type: 'uuid' })
  @Index()
  documentId: string;

  /** Client-generated comment mark id used to reconnect the persisted thread to TipTap JSON. */
  @Column({ name: 'anchor_id', type: 'varchar', length: 80 })
  @Index()
  anchorId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  author: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  mentions: string[] | null;

  @Column({ name: 'quoted_text', type: 'text', nullable: true })
  quotedText: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  anchor: { from?: number; to?: number } | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  replies: OfficeCommentReply[] | null;

  @Column({ name: 'assigned_to', type: 'varchar', length: 120, nullable: true })
  @Index()
  assignedTo: string | null;

  @Column({ type: 'boolean', default: false })
  @Index()
  resolved: boolean;

  @Column({ name: 'resolved_by', type: 'varchar', length: 120, nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
