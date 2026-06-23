import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_members')
@Unique(['conversationId', 'userId'])
export class ConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Marca hasta cuándo el usuario leyó esta conversación (para no leídos). */
  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  /** Fijada arriba por este usuario (null = no fijada). */
  @Column({ name: 'pinned_at', type: 'timestamptz', nullable: true })
  pinnedAt: Date | null;

  /** Archivada por este usuario (null = en la bandeja principal). */
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  /** Notificaciones silenciadas hasta esta fecha (null = no silenciada). */
  @Column({ name: 'muted_until', type: 'timestamptz', nullable: true })
  mutedUntil: Date | null;

  /** El usuario la marcó como "no leída" manualmente. */
  @Column({ name: 'marked_unread', type: 'boolean', default: false })
  markedUnread: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => Conversation, (c) => c.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
