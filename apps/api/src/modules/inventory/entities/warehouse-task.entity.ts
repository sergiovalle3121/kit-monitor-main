import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne } from 'typeorm';

export enum WarehouseTaskType {
  PUT_AWAY = 'put_away',
  TRANSFER = 'transfer',
  PICK = 'pick',
  CONFIRM = 'confirm'
}

export enum WarehouseTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@Entity('warehouse_tasks')
export class WarehouseTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  taskNumber: string; // TSK-2024-0001

  @Column({ type: 'varchar', length: 32 })
  type: WarehouseTaskType;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: WarehouseTaskStatus;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  partNumber: string;

  @Column({ type: 'float' })
  quantity: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lotNumber?: string;

  // Source
  @Column({ type: 'varchar', length: 64 })
  fromWarehouseId: string;

  @Column({ type: 'varchar', length: 100 })
  fromLocation: string;

  // Destination
  @Column({ type: 'varchar', length: 64 })
  toWarehouseId: string;

  @Column({ type: 'varchar', length: 100 })
  toLocation: string;

  // Governance
  @Column({ type: 'varchar', length: 120, nullable: true })
  assignedTo?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  completedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceType?: string; // e.g. RECEIPT, WO, KIT

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceId?: string;

  // ─── PULL MODEL (aditivo, todo nullable / con default) ──────────────────────
  // Un "pull" es un pedido de material del piso al almacén. Se modela SOBRE
  // warehouse_tasks (un PICK con estos campos) sin romper las tareas existentes.

  /** Proyecto/programa que pide el material (p.ej. AX-100). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index()
  project?: string;

  /** Quién solicita el material desde el piso (line lead, ingeniería…). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  requestor?: string;

  /** Pull urgente: salta al frente de la cola y dispara aviso al handler. */
  @Column({ type: 'boolean', default: false })
  urgent: boolean;

  /** Número de intentos/manipulaciones del pull (se incrementa al tomarlo). */
  @Column({ type: 'int', default: 0 })
  touches: number;

  /** SLA del pull en minutos; si el aging lo supera, semáforo en rojo. */
  @Column({ type: 'int', nullable: true })
  slaMinutes?: number;

  /** Momento en que el pull fue ENTREGADO (surte el cálculo de aging final). */
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  /** Momento en que el pull fue CANCELADO. */
  @Column({ type: 'timestamp', nullable: true })
  canceledAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
