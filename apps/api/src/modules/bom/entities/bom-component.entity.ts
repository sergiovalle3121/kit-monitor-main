import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { BomHeader } from './bom-header.entity';

@Entity('bom_components')
@Unique(['bomHeader', 'componentNumber'])
export class BomComponent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @ManyToOne(() => BomHeader, (header) => header.components, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bom_header_id' })
  bomHeader: BomHeader;

  @Column({ name: 'bom_header_id' })
  @Index()
  bomHeaderId: number;

  @Column({ type: 'int', default: 1 })
  level: number; // Nivel en la estructura jerárquica (0 = nivel superior, 1 = subensamble, etc.)

  @Column({ type: 'varchar', length: 100 })
  @Index()
  componentNumber: string; // Número de parte del componente (debe existir en MaterialMaster)

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string; // Descripción del componente

  @Column({ type: 'float', default: 1 })
  quantity: number; // Cantidad requerida por unidad base del producto final

  @Column({ type: 'varchar', length: 20, default: 'EA' })
  unit: string; // Unidad de medida (EA, KG, M, L, etc.)

  @Column({ type: 'float', default: 1 })
  usageFactor: number; // Factor de uso/merma (ej: 1.05 para 5% de merma)

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceDesignator: string; // Designadores de referencia (ej: R1, R2, C1-C10)

  @Column({ type: 'text', nullable: true })
  notes: string; // Notas adicionales

  @Column({ type: 'float', default: 0 })
  standardCost: number; // Costo estándar unitario (puede venir de MaterialMaster)

  @Column({ type: 'float', default: 0 })
  extendedCost: number; // Costo extendido (quantity * usageFactor * standardCost)

  @Column({ type: 'boolean', default: false })
  isPhantom: boolean; // Si es un subensamble fantasma (no se inventaría)

  @Column({ type: 'timestamptz', nullable: true })
  effectiveDate: Date | null; // Fecha de efectividad del componente

  @Column({ type: 'timestamptz', nullable: true })
  expirationDate: Date | null; // Fecha de expiración del componente

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
