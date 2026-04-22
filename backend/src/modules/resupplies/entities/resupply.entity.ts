import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

export type ResupplyStatus = 
  | 'requested' 
  | 'acknowledged' 
  | 'pick_started' 
  | 'pick_completed' 
  | 'in_transit' 
  | 'delivered' 
  | 'confirmed' 
  | 'escalated' 
  | 'cancelled';

export type ResupplyPriority = 'low' | 'medium' | 'high' | 'critical';

@Entity('resupplies')
export class Resupply {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, (kit) => kit.resupplies)
  kit: Kit;

  @Column()
  partNumber: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'float' })
  quantityRequested: number;

  @Column({ type: 'float', nullable: true })
  quantityDelivered: number;

  @Column({ default: 'requested' })
  status: ResupplyStatus;

  @Column({ default: 'medium' })
  priority: ResupplyPriority;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  ownerId: string;

  @Column({ nullable: true })
  ownerName: string;

  // Trazabilidad de SLA
  @CreateDateColumn()
  requestedAt: Date;

  @Column({ nullable: true })
  acknowledgedAt: Date;

  @Column({ nullable: true })
  pickStartedAt: Date;

  @Column({ nullable: true })
  pickCompletedAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  escalatedAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;
}
