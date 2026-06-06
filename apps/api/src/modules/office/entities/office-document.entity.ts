import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type OfficeDocType = 'doc' | 'sheet' | 'slides';

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

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
