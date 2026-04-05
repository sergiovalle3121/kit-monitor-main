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

  @Column({ type: 'text' })
  pdfUrl: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  uploadedBy?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
