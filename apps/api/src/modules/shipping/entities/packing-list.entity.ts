import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { Shipment } from './shipment.entity';

@Entity('packing_lists')
export class PackingList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  packingListNumber: string;

  @ManyToOne(() => Shipment)
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ type: 'varchar', length: 100 })
  customer: string;

  @Column({ type: 'jsonb', nullable: true })
  items: any[];

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  generatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
