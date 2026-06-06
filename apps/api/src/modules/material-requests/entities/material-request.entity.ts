import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';
import type { MaterialRequestStatus } from '../request-state';

/**
 * A pull request raised by production against a published kit's PickList.
 * The warehouse authorizes (or rejects) it; later it is marked fulfilled when
 * the material is delivered.
 */
@Entity('material_requests')
export class MaterialRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kitId' })
  kit: Kit;

  @Column()
  @Index()
  kitId: number;

  @Column({ type: 'varchar', length: 120 })
  requestedBy: string;

  @Column({ default: 'pending' })
  @Index()
  status: MaterialRequestStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  decidedBy: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
