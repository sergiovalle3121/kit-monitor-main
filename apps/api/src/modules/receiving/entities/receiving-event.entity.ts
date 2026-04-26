import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('receiving_events')
export class ReceivingEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  receiptNumber: string; // REC-2024-0001

  @Column({ type: 'varchar', length: 32 })
  @Index()
  supplierCode: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber?: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 64 })
  warehouseId: string;

  @Column({ type: 'varchar', length: 100 })
  location: string; // Dock name / Initial bin

  @Column({ type: 'varchar', length: 64, nullable: true })
  poNumber?: string;

  @Column({ type: 'varchar', length: 120 })
  receivedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
