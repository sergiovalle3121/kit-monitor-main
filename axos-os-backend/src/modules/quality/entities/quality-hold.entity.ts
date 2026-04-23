import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type QualityHoldLevel = 
  | 'PART_NUMBER' 
  | 'LOT' 
  | 'SERIAL' 
  | 'WAREHOUSE' 
  | 'BUILDING' 
  | 'PROGRAM' 
  | 'WORK_ORDER';

@Entity('quality_holds')
export class QualityHold {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 32 })
  level: QualityHoldLevel;

  @Column({ type: 'varchar', length: 100, nullable: true })
  levelValue?: string; // e.g. WH-01, LOT-XYZ, WO-999

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 120 })
  reason: string;

  @Column({ type: 'varchar', length: 120 })
  heldBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  releasedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
