import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

export type ExceptionType = 'missing_material' | 'excess' | 'quality' | 'other';
export type ExceptionStatus = 'open' | 'resolved';

// Named KitException to avoid collision with JS built-in Error/Exception concepts
@Entity('kit_exceptions')
export class KitException {
  @PrimaryGeneratedColumn()
  id: number;

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

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;
}
