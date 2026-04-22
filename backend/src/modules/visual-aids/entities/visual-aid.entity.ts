import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('visual_aids')
export class VisualAid {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  model: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'varchar', length: 120 })
  process: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  revision?: string | null;

  @Column({ name: 'filename', type: 'text' })
  pdfUrl: string;

  @Column({ name: 'pdf_data', type: 'bytea', nullable: true, select: false })
  pdfData?: Buffer | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  uploadedBy?: string | null;

  @Column({ type: 'json', nullable: true })
  annotations?: any | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
