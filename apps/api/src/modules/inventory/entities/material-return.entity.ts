import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum MaterialReturnStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Devolución de material al almacén (return to stock). Entidad NUEVA y aditiva:
 * registra el material que regresa (parte, cantidad, batch, vendor, origen→destino,
 * motivo) y genera un documento/etiqueta imprimible. Al confirmarla, el stock puede
 * reingresar vía InventoryService.recordTransaction (método ya expuesto), sin tocar
 * la lógica de inventory.
 *
 * Estilo plano (sin TenantBaseEntity) para mantener consistencia con el resto del
 * módulo inventory (warehouse_tasks, inventory_*), que se scope-a por
 * user.scopes.buildings y no por tenant_id.
 */
@Entity('material_returns')
export class MaterialReturn {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  returnNumber: string; // RET-2024-0001

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: MaterialReturnStatus;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description?: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  uom?: string;

  /** Lote / batch del material devuelto (nullable). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  batch?: string;

  /** Proveedor de origen del material (nullable). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  vendor?: string;

  /** Proyecto/programa al que pertenecía el material (para analítica). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  project?: string;

  // Origen → Destino
  @Column({ type: 'varchar', length: 100, nullable: true })
  fromLocation?: string; // de dónde regresa (línea / estación)

  @Column({ type: 'varchar', length: 64 })
  toWarehouseId: string; // almacén que recibe

  @Column({ type: 'varchar', length: 100, nullable: true })
  toLocation?: string; // ubicación destino dentro del almacén

  /** Motivo de la devolución (sobrante de kit, scrap recuperable, cambio de orden…). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  /** Si la confirmación reingresó el material al inventario. */
  @Column({ type: 'boolean', default: false })
  restocked: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdBy?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  completedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
