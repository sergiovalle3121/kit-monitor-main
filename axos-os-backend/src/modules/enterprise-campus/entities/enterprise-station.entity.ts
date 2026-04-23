import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EnterpriseLine } from './enterprise-line.entity';

export type EnterpriseStationStatus = 'active' | 'disabled' | 'maintenance';

@Entity('enterprise_stations')
export class EnterpriseStation {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @ManyToOne(() => EnterpriseLine, (line) => line.stations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'line_id' })
  line: EnterpriseLine;

  @Column({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseStationStatus;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
