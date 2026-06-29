import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OfficeReviewTaskStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Reviewer assignment and disposition for controlled document review routes. */
@Entity('office_document_review_tasks')
export class OfficeDocumentReviewTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'document_id' })
  @Index()
  documentId: string;

  @Column({ type: 'varchar', length: 120, name: 'reviewer_email' })
  @Index()
  reviewerEmail: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'assigned_by' })
  assignedBy: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status: OfficeReviewTaskStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'due_at' })
  dueAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'decided_at' })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'text', nullable: true, name: 'decision_note' })
  decisionNote: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'signature_id' })
  signatureId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
