import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ConversationMember } from './conversation-member.entity';

export type ConversationType = 'dm' | 'channel';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 100, nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'dm' })
  type: ConversationType;

  /** Solo para canales. Los DM no tienen nombre (se deriva del otro usuario). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  /** Mensajes temporales: segundos hasta que expiran (0 = desactivado). */
  @Column({ name: 'disappearing_seconds', type: 'int', default: 0 })
  disappearingSeconds: number;

  @OneToMany(() => ConversationMember, (m) => m.conversation)
  members: ConversationMember[];
}
