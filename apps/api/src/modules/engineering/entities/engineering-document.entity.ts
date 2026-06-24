import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EngineeringDocumentType {
  VISUAL_AID = 'VISUAL_AID',
  PLANT_LAYOUT = 'PLANT_LAYOUT',
}

@Entity('engineering_documents')
export class EngineeringDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'enum', enum: EngineeringDocumentType })
  documentType: EngineeringDocumentType;

  @Column({ type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ type: 'jsonb', nullable: true })
  scope: {
    buildingId?: string;
    programId?: string;
    lineId?: string;
    model?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  viewport: {
    zoom: number;
    x: number;
    y: number;
  };

  @Column({ type: 'varchar', length: 20, default: 'px' })
  units: string;

  @Column({ type: 'jsonb', default: { layers: [], objects: [] } })
  content: {
    layers: any[];
    objects?: any[];
    geometry?: any[];
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'varchar', length: 120 })
  createdBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
