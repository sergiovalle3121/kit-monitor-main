import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlanScenario } from './plan-scenario.entity';

@Entity('scenario_simulation_results')
export class ScenarioSimulationResult {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PlanScenario, { onDelete: 'CASCADE' })
  scenario: PlanScenario;

  @Column({ type: 'varchar', length: 24 })
  simulationMode: string;

  @Column({ type: 'int', default: 0 })
  numRuns: number;

  @Column({ type: 'float', default: 0 })
  probabilityOfPlanSuccess: number;

  @Column({ type: 'float', default: 0 })
  probabilityOfShortage: number;

  @Column({ type: 'float', default: 0 })
  probabilityOfCapacityOverload: number;

  @Column({ type: 'float', default: 0 })
  probabilityOfOvertime: number;

  @Column({ type: 'simple-json', nullable: true })
  percentiles?: Record<string, any>;

  @Column({ type: 'float', default: 0 })
  dataSufficiencyScore: number;

  @Column({ type: 'simple-json', nullable: true })
  drivers?: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  assumptionsSnapshot?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
