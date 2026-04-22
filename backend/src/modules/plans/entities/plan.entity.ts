import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToOne,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

// Status flow: pending → active → completed | cancelled
export type PlanStatus = 'pending' | 'active' | 'completed' | 'cancelled';
// Shifts
export type Shift = 'T1' | 'T2' | 'T3';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  workOrder: string; // WO identifier from planning system

  @Column()
  model: string; // product model code — matches BomItem.model

  @Column({ type: 'int' })
  line: number; // 1–7

  @Column({ type: 'int', nullable: true })
  bahia: number; // 1–6 (optional — kit is per line)

  @Column({ type: 'int' })
  quantity: number; // units to assemble

  @Column()
  shift: string; // T1 | T2 | T3

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'int', default: 0 })
  sequence: number; // within-shift order

  @Column({ default: 'pending' })
  status: PlanStatus;

  @OneToOne(() => Kit, (kit) => kit.plan, { nullable: true })
  kit: Kit;

  @CreateDateColumn()
  createdAt: Date;
}
