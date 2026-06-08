import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Reacción (emoji) de un usuario a un mensaje — estilo Teams/Slack.
 * Tabla PREFIJADA `chat_message_reactions` (aditiva, no choca con legacy).
 * Un usuario puede tener a lo sumo UNA fila por (mensaje, emoji) → toggle.
 */
@Entity('chat_message_reactions')
@Unique(['messageId', 'userId', 'emoji'])
export class ChatMessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  emoji: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'varchar', length: 100, nullable: true })
  tenantId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
