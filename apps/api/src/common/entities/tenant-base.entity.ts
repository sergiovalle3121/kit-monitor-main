import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class TenantBaseEntity {
  @Column({ type: 'uuid', nullable: false })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: false })
  organization_id: string;

  @Column({ type: 'uuid', nullable: false })
  plant_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'created_by' })
  created_by: string | null;
}
