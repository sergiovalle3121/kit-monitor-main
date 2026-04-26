import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EnterpriseBuilding } from './enterprise-building.entity';
import { EnterpriseArea } from './enterprise-area.entity';
import { EnterpriseStation } from './enterprise-station.entity';

export type EnterpriseLineStatus =
  | 'active'
  | 'idle'
  | 'maintenance'
  | 'offline';

@Entity('enterprise_lines')
export class EnterpriseLine {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @ManyToOne(() => EnterpriseBuilding, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'building_id' })
  building: EnterpriseBuilding;

  @ManyToOne(() => EnterpriseArea, (area) => area.lines, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'area_id' })
  area: EnterpriseArea;

  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status: EnterpriseLineStatus;

  @Column({ type: 'int', nullable: true })
  legacyLineNumber?: number | null;

  @Column({ type: 'int', default: 0 })
  capacityPerShift: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  activeShift?: string | null;

  @Column({ type: 'simple-array', default: '' })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => EnterpriseStation, (station) => station.line)
  stations: EnterpriseStation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
