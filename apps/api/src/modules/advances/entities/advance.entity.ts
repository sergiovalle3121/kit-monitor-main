import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Kit } from '../../kits/entities/kit.entity';

@Entity('advances')
export class Advance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @ManyToOne(() => Kit, (kit) => kit.advances)
  kit: Kit;

  @Column({ type: 'int' })
  unitsAssembled: number; // incremental units reported in this entry

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  registeredAt: Date;
}
