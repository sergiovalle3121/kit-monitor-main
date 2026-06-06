import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Optional supervisor assignment of an operator to a station for an execution.
 * The operator board highlights the assigned station; operators can still
 * self-serve any station when no assignment exists (the "mezcla").
 */
@Entity('mes_station_assignments')
@Index(['executionId', 'stepId'])
export class StationAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  executionId: number;

  @Column({ type: 'int' })
  stepId: number;

  @Column({ type: 'varchar', length: 120 })
  operatorName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  operatorId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  assignedBy: string | null;

  @Column({ type: 'boolean', default: true })
  @Index()
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
