import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum UserRole {
  ADMIN = 'Admin',
  PLANNER = 'Planner',
  MATERIALS_LEAD = 'Materials Lead',
  WAREHOUSE_OPERATOR = 'Warehouse Operator',
  PRODUCTION_SUPERVISOR = 'Production Supervisor',
  QUALITY_ENGINEER = 'Quality Engineer',
  QUALITY_MANAGER = 'Quality Manager',
  SHIPPING_LEAD = 'Shipping Lead'
}

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
  permissions: string[]; // ['RELEASE_WO', 'APPROVE_QUALITY', 'DISPATCH']

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
