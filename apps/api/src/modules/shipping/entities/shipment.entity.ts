import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';

export enum ShipmentStatus {
  PLANNING = 'planning',
  STAGED = 'staged',
  LOADING = 'loading',
  DISPATCHED = 'dispatched',
  CLOSED = 'closed'
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  shipmentNumber: string; // SHP-2024-001

  @Column({ type: 'varchar', length: 32, default: 'planning' })
  status: ShipmentStatus;

  @Column({ type: 'varchar', length: 120 })
  customer: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  carrier?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  truckPlate?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  driverName?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  dockNumber?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  trackingNumber?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  route?: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  loadingStartedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt?: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  dispatchedBy?: string;

  @Column({ type: 'jsonb', nullable: true })
  manifestData?: any;

  // Folio ASN (EDI 856) emitido al generar el aviso de embarque (aditivo, nullable).
  @Column({ type: 'varchar', length: 32, nullable: true })
  asn?: string;

  // SSCC GS1 (18 dígitos) de la etiqueta logística del embarque (aditivo, nullable).
  @Column({ type: 'varchar', length: 20, nullable: true })
  sscc?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
