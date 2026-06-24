import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('governance_policies')
export class GovernancePolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ unique: true })
  domain: string; // QUALITY, SHIPPING, etc.

  @Column({ type: 'int', default: 1 })
  escalationThresholdHours: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  routingOverrides: any; // { "CRITICAL": ["Site Manager"] }

  @UpdateDateColumn()
  updatedAt: Date;
}
