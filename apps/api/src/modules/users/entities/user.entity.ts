import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export enum UserRole {
  ADMIN = 'Admin',
  PLANNER = 'Planner',
  MATERIALS_LEAD = 'Materials Lead',
  WAREHOUSE_OPERATOR = 'Warehouse Operator',
  PRODUCTION_SUPERVISOR = 'Production Supervisor',
  QUALITY_ENGINEER = 'Quality Engineer',
  QUALITY_MANAGER = 'Quality Manager',
  SHIPPING_LEAD = 'Shipping Lead',
}

export type UserStatus = 'pending' | 'active' | 'rejected';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100, nullable: true })
  @Index()
  tenantId: string;

  @Column()
  username: string;

  /** Display name (from the frontend registration). */
  @Column({ type: 'varchar', length: 160, nullable: true })
  name: string | null;

  /** Job-catalog position id; drives the role/permission mapping. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  position: string | null;

  @Column({ select: false })
  password: string;

  @Column({ type: 'varchar', length: 50, default: UserRole.WAREHOUSE_OPERATOR })
  role: UserRole;

  @Column({ type: 'jsonb', nullable: true })
  scopes: {
    buildings?: string[];
    programs?: string[];
    lines?: number[];
    warehouses?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[]; // ['production:read', 'materials:write', ...]

  /** Account lifecycle: self-registered users start 'pending' until an admin approves. */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  @Index()
  status: UserStatus;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  approvedBy: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
