import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { BomComponent } from './bom-component.entity';
import { MaterialMaster } from '../../inventory/entities/material-master.entity';

export enum BomStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  OBSOLETE = 'OBSOLETE',
}

@Entity('bom_headers')
@Unique(['model', 'revision'])
export class BomHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  model: string; // Modelo/Product ID final (ej: PRD-9921)

  @Column({ type: 'varchar', length: 100, nullable: true })
  productName: string; // Nombre descriptivo del producto

  @Column({ type: 'varchar', length: 20, default: '1.0' })
  revision: string; // Revisión del BOM (ej: 1.0, 1.1, 2.0)

  @Column({ type: 'enum', enum: BomStatus, default: BomStatus.DRAFT })
  status: BomStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bomType: string; // Manufacturing, Engineering, Sales, etc.

  @Column({ type: 'float', default: 1 })
  baseQuantity: number; // Cantidad base para la cual está definido el BOM

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  baseUnit: string; // Unidad de medida base (EA, KG, etc.)

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ type: 'float', default: 0 })
  estimatedCost: number; // Costo estimado total calculado por rollup

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => BomComponent, (component) => component.bomHeader, { cascade: true })
  components: BomComponent[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
