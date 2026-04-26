import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('governance_policies')
export class GovernancePolicy {
  @PrimaryGeneratedColumn()
  id: number;

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
