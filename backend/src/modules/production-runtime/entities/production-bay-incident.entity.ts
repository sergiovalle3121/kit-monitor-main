import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('production_bay_incidents')
export class ProductionBayIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kit, { onDelete: 'CASCADE' })
  kit: Kit;

  @Column({ type: 'int' })
  bayId: number;

  @Column({ type: 'varchar', length: 80 })
  type: string;

  @Column({ type: 'varchar', length: 280, nullable: true })
  note?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  operator?: string | null;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
