import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type OfficeSignatureMeaning = 'reviewed' | 'approved' | 'released' | 'acknowledged' | 'training_ack';
export type OfficeSignatureType = 'electronic' | 'digital_placeholder';

/** Electronic-signature evidence for controlled Office documents. */
@Entity('office_document_signatures')
export class OfficeDocumentSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'document_id' })
  @Index()
  documentId: string;

  @Column({ type: 'varchar', length: 32 })
  meaning: OfficeSignatureMeaning;

  @Column({ type: 'varchar', length: 32, name: 'signature_type', default: 'electronic' })
  signatureType: OfficeSignatureType;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'signer_email' })
  signerEmail: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'signer_name' })
  signerName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'signer_role' })
  signerRole: string | null;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'varchar', length: 128, name: 'content_hash' })
  contentHash: string;

  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'revoked_by' })
  revokedBy: string | null;

  @Column({ type: 'timestamp', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'signed_at' })
  signedAt: Date;
}
