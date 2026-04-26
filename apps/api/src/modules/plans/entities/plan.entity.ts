import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  Index,
} from 'typeorm';

import { Kit } from '../../kits/entities/kit.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type PlanStatus =
  | 'pending'
  | 'released'
  | 'active'
  | 'completed'
  | 'cancelled';
export type PlanPriority = 'low' | 'normal' | 'high' | 'critical';

@Entity('plans')
@Index(['tenant_id', 'status'])
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    name: 'organization_id',
  })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  @Column({ unique: true })
  @Index()
  workOrder: string;

  @Column()
  model: string;

  @Column({ type: 'int' })
  line: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  buildingId: string;

  @Column({ type: 'int', nullable: true })
  bahia: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column()
  shift: string;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  scheduledAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  dueDate: Date;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ default: 'pending' })
  status: PlanStatus;

  @Column({ default: 'normal' })
  priority: PlanPriority;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  releasedAt: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  releasedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  readinessSummary: any; // { materials: 'green', quality: 'red', shipping: 'yellow' }

  @OneToOne(() => Kit, (kit) => kit.plan, { nullable: true })
  kit: Kit;

  @CreateDateColumn()
  createdAt: Date;
}
