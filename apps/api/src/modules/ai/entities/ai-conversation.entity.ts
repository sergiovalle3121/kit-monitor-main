import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A copilot conversation thread, scoped to its tenant + owner. */
@Entity('ai_conversation')
@Index(['tenantId', 'userEmail'])
export class AiConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tenantId: string | null;

  @Column()
  userEmail: string;

  @Column({ type: 'varchar', length: 200, default: 'Nueva conversación' })
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
