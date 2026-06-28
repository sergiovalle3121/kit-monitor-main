import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export interface OfficeDocumentSearchRef {
  entity: string;
  refId: string;
  label?: string;
}

/** Denormalized, tenant-scoped search surface for Office documents. */
@Entity('office_document_search_index')
export class OfficeDocumentSearchIndex {
  @PrimaryColumn({ type: 'uuid', name: 'document_id' })
  documentId: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string | null;

  @Column({ type: 'text', default: '' })
  text: string;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  refs: OfficeDocumentSearchRef[] | null;

  @Column({ type: 'text', default: '', name: 'refs_text' })
  refsText: string;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  fields: Record<string, string> | null;

  @Column({ type: 'text', default: '', name: 'fields_text' })
  fieldsText: string;

  @Column({ type: 'int', default: 0, name: 'word_count' })
  wordCount: number;

  @Column({ type: 'int', default: 0, name: 'ref_count' })
  refCount: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
