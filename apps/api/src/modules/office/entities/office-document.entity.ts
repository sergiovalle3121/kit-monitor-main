import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type OfficeDocType = 'doc' | 'sheet' | 'slides';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Soft-delete marker. Documents move to the trash instead of being erased. */
  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
