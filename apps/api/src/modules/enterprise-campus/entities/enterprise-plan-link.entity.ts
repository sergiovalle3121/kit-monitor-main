import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { EnterpriseProgram } from './enterprise-program.entity';
import { EnterpriseBuilding } from './enterprise-building.entity';
import { EnterpriseLine } from './enterprise-line.entity';

@Entity('enterprise_plan_links')
export class EnterprisePlanLink {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Plan, { nullable: false, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @ManyToOne(() => EnterpriseProgram, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'program_id' })
  program?: EnterpriseProgram | null;

  @ManyToOne(() => EnterpriseBuilding, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'building_id' })
  building?: EnterpriseBuilding | null;

  @ManyToOne(() => EnterpriseLine, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'line_id' })
  line?: EnterpriseLine | null;

  @Column({ type: 'varchar', length: 24, default: 'explicit' })
  mappingMethod: 'explicit' | 'line_map' | 'model_prefix_fallback';

  @Column({ type: 'float', default: 1 })
  confidenceScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
