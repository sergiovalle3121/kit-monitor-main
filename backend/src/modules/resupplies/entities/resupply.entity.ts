import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

export type ResupplyStatus = 'requested' | 'in_transit' | 'delivered';

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

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;
}
