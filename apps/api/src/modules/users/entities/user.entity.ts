import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

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

@Entity('users')
@Index(['tenant_id', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Multi-tenant identity ────────────────────────────────────────────────
  // Nullable during migration; will be NOT NULL once tenant management is live.
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'organization_id' })
  organization_id: string | null;

  // Default plant for this user; null means org-level access (multi-plant).
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'plant_id' })
  plant_id: string | null;

  // ── Core identity ────────────────────────────────────────────────────────
  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'varchar', length: 50, default: UserRole.WAREHOUSE_OPERATOR })
  role: UserRole;

  // ── Authorization ────────────────────────────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  scopes: {
    buildings?: string[];
    programs?: string[];
    lines?: number[];
    warehouses?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ default: true })
  isActive: boolean;

  // ── Audit timestamps ─────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
