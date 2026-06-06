import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JSON_COLUMN_TYPE } from '../../../common/database/json-column-type';

export type AiMessageRole = 'user' | 'assistant';

/** A single message in a conversation. Tool usage is recorded for auditability. */
@Entity('ai_message')
@Index(['conversationId', 'createdAt'])
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  conversationId: string;

  @Column({ type: 'varchar', length: 16 })
  role: AiMessageRole;

  @Column({ type: 'text' })
  content: string;

  /** Names of the grounding tools the assistant used to answer this turn. */
  @Column({ type: JSON_COLUMN_TYPE, nullable: true })
  toolsUsed: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
