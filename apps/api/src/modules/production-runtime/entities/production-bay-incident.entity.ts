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
