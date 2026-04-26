import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

@Entity('production_bay_events')
@Index(['clientRequestId'], { unique: true })
@Index(['tenant_id', 'bayId'])
export class ProductionBayEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'organization_id' })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  kit: Kit;

  @Column({ type: 'int' })
  bayId: number;

  @Column({ type: 'varchar', length: 80 })
  model: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  operator?: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  notes?: string;

  @Column({ type: 'varchar', length: 32, default: 'bay_enter' })
  source: string;

  @Column({ type: DATE_COLUMN_TYPE })
  timestamp: Date;

  @Column({ type: 'varchar', length: 80, nullable: true })
  clientRequestId?: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  revertedAt?: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  revertedReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
