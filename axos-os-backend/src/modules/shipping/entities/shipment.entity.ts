import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';

export enum ShipmentStatus {
  PLANNING = 'planning',
  STAGING = 'staging',
  PACKED = 'packed',
  DISPATCHED = 'dispatched',
  DELIVERED = 'delivered'
}

@Entity('shipments')
export class Shipment {
  @PrimaryGeneratedColumn()
  id: number;

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
  trackingNumber?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  destinationWarehouse?: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt?: Date;

  @Column({ type: 'varchar', length: 120, nullable: true })
  dispatchedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
