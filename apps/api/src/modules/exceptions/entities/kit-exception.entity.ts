import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

export type ExceptionType = 'missing_material' | 'excess' | 'quality' | 'other';
export type ExceptionStatus = 'open' | 'resolved';

// Named KitException to avoid collision with JS built-in Error/Exception concepts
@Entity('kit_exceptions')
export class KitException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @ManyToOne(() => Kit, (kit) => kit.exceptions)
  kit: Kit;

  @Column()
  type: ExceptionType;

  @Column({ nullable: true })
  partNumber: string; // relevant NP, if applicable

  @Column()
  description: string;

  @Column({ default: 'open' })
  status: ExceptionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true })
  resolvedAt: Date;
}
