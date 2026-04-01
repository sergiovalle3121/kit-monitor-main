import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { KitMaterial } from '../../kit-materials/entities/kit-material.entity';
import { Advance } from '../../advances/entities/advance.entity';
import { Resupply } from '../../resupplies/entities/resupply.entity';
import { KitException } from '../../exceptions/entities/kit-exception.entity';

// Status flow: prepared → sent → received → in_progress → completed
export type KitStatus = 'prepared' | 'sent' | 'received' | 'in_progress' | 'completed';

@Entity('kits')
export class Kit {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Plan, (plan) => plan.kit)
  @JoinColumn()
  plan: Plan;

  @Column({ default: 'prepared' })
  status: KitStatus;

  @Column({ type: 'timestamp', nullable: true })
  preparedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt: Date;

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
