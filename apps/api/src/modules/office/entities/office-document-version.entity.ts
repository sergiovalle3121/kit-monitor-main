import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

/**
 * A point-in-time snapshot of an OfficeDocument. Snapshots are taken
 * (throttled) as the document is edited and on demand, so users can restore a
 * previous state. Kept lean — no FK so it stays `synchronize: true`-friendly.
 */
@Entity('office_document_versions')
@Index(['documentId', 'createdAt'])
export class OfficeDocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  documentId: string;

  @Column({ type: 'varchar', length: 200, default: 'Sin título' })
  title: string;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  content: any;

  /** Optional human label, e.g. "Antes de restaurar" or a named version. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
