import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('line_capacities')
export class LineCapacity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'int' })
  @Index()
  line: number;

  @Column({ type: 'varchar', length: 32 })
  buildingId: string;

  @Column({ type: 'float' })
  dailyCapacityUnits: number;

  @Column({ type: 'float', default: 100 })
  efficiencyFactor: number; // 0-100

  @Column({ type: 'jsonb', nullable: true })
  constraints?: any; // { modelRestricted: ['MOD-A'] }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
