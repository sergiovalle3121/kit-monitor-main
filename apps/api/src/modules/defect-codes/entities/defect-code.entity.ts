import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Catálogo estandarizado de CÓDIGOS DE DEFECTO (la base del Pareto/PPM).
 *
 * Aditivo y opcional: hoy las NCR guardan el defecto como TEXTO LIBRE
 * (`ncrs.category`), lo que hace débil cualquier Pareto. Este catálogo permite
 * CLASIFICAR una NCR con un código tipificado por FAMILIA (soldadura, componente,
 * cosmético, funcional, mecánico, proceso) sin tocar el alta de NCR: la columna
 * `ncrs.defectCodeId` es nullable y las NCR viejas siguen funcionando con su
 * texto libre (se agrupan como «Sin clasificar»).
 *
 * No es jerárquico ni sobre-diseñado: un código pertenece a una familia
 * (`category`) y opcionalmente sugiere una severidad por defecto. Los
 * `cause_codes` (causa raíz estandarizada) quedan como follow-up.
 */
export enum DefectFamily {
  SOLDER = 'solder', // soldadura
  COMPONENT = 'component', // componente
  COSMETIC = 'cosmetic', // cosmético
  FUNCTIONAL = 'functional', // funcional
  MECHANICAL = 'mechanical', // mecánico
  PROCESS = 'process', // proceso / documentación
}

@Entity('defect_codes')
export class DefectCode {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código corto y único, p.ej. SOL-COLD, CMP-MISS. */
  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  code: string;

  /** Descripción legible del defecto. */
  @Column({ type: 'varchar', length: 160 })
  description: string;

  /** Familia del defecto (para los cortes y el color del Pareto). */
  @Column({ type: 'varchar', length: 24, default: DefectFamily.PROCESS })
  category: DefectFamily;

  /** Severidad sugerida (minor/major/critical). Nullable: es solo una guía. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  defaultSeverity?: string | null;

  /** Códigos inactivos no se ofrecen para clasificar, pero el histórico se respeta. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
