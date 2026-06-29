import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type OfficeDocType = 'doc' | 'sheet' | 'slides';
export type OfficeDocumentLifecycleState = 'draft' | 'in_review' | 'approved' | 'effective' | 'obsolete';

/** A single sharing grant on a document. */
export interface OfficeShare {
  email: string;
  access: 'view' | 'edit';
}

/**
 * A document created in the in-app office suite (Word/Excel/PowerPoint-like).
 * `content` holds the editor-specific payload: TipTap JSON for 'doc',
 * Fortune-sheet data for 'sheet', a slide array for 'slides'.
 */
@Entity('office_documents')
export class OfficeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  @Index()
  type: OfficeDocType;

  @Column({ type: 'varchar', length: 200, default: 'Sin título' })
  title: string;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  content: any;

  /** Optional link to a model — lets a presentation be used as a visual aid. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  /** Owner of the document (the user that created it). Acts as the scope key. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index()
  createdBy: string | null;

  /**
   * Organizational scope. Nullable so pre-existing rows keep working under
   * `synchronize: true`; new documents inherit the creator's tenant.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  tenantId: string | null;

  /** Owner-managed sharing grants (view/edit) for other users. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  sharedWith: OfficeShare[] | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  @Index()
  space: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true, name: 'folder_path' })
  @Index()
  folderPath: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  collection: string | null;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  tags: string[] | null;

  @Column({ type: 'boolean', default: false })
  favorite: boolean;

  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  /** Controlled-document lifecycle for governed SOP/WI/quality records. */
  @Column({ type: 'varchar', length: 24, name: 'lifecycle_state', default: 'draft' })
  @Index()
  lifecycleState: OfficeDocumentLifecycleState;

  /** Effective/obsolete documents are locked against content edits. */
  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  releasedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  obsoletedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  obsoletedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'next_review_at' })
  @Index()
  nextReviewAt: Date | null;

  @Column({ type: 'int', nullable: true, name: 'review_interval_days' })
  reviewIntervalDays: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'review_owner' })
  @Index()
  reviewOwner: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Soft-delete marker. Documents move to the trash instead of being erased. */
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
