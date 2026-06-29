import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OfficeTrainingStatus = 'pending' | 'acknowledged' | 'cancelled';

/** Training / read-and-understood assignment for controlled documents. */
@Entity('office_document_training_assignments')
export class OfficeDocumentTrainingAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string | null;

  @Column({ type: 'uuid', name: 'document_id' })
  @Index()
  documentId: string;

  @Column({ type: 'varchar', length: 120, name: 'assignee_email' })
  @Index()
  assigneeEmail: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'assigned_by' })
  assignedBy: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status: OfficeTrainingStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'due_at' })
  dueAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'acknowledged_at' })
  acknowledgedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'signature_id' })
  signatureId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
