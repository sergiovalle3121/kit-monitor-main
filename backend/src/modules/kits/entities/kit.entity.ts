import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { KitMaterial } from '../../kit-materials/entities/kit-material.entity';
import { Advance } from '../../advances/entities/advance.entity';
import { Resupply } from '../../resupplies/entities/resupply.entity';
import { KitException } from '../../exceptions/entities/kit-exception.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

// Status flow: preparing → kitted → ready → requested → delivered → in_progress → completed
// Legacy aliases kept for backward compat: prepared, sent, received
export type KitStatus =
  | 'preparing' | 'kitted' | 'ready' | 'requested' | 'delivered'
  | 'in_progress' | 'completed' | 'cancelled'
  | 'prepared' | 'sent' | 'received'; // legacy

@Entity('kits')
export class Kit {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Plan, (plan) => plan.kit)
  @JoinColumn()
  plan: Plan;

  @Column({ default: 'preparing' })
  status: KitStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  preparedAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  sentAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  receivedAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  kittedAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  requestedAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  deliveredAt: Date;

  @OneToMany(() => KitMaterial, (m) => m.kit)
  materials: KitMaterial[];

  @OneToMany(() => Advance, (a) => a.kit)
  advances: Advance[];

  @OneToMany(() => Resupply, (r) => r.kit)
  resupplies: Resupply[];

  @OneToMany(() => KitException, (e) => e.kit)
  exceptions: KitException[];

  @CreateDateColumn()
  createdAt: Date;
}
