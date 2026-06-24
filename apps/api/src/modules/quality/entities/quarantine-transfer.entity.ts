import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { QualityHold } from './quality-hold.entity';

export enum QuarantineTransferStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Entity('quarantine_transfers')
export class QuarantineTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @ManyToOne(() => QualityHold)
  hold: QualityHold;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 64 })
  sourceWarehouseId: string;

  @Column({ type: 'varchar', length: 100 })
  sourceLocation: string;

  @Column({ type: 'varchar', length: 64 })
  destWarehouseId: string;

  @Column({ type: 'varchar', length: 100, default: 'QUARANTINE-01' })
  destLocation: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: QuarantineTransferStatus;

  @Column({ type: 'varchar', length: 120 })
  requestedBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  completedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
