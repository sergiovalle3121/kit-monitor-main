import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Mensaje guardado/destacado por un usuario ("mensajes guardados"). Es personal:
 * cada quien marca los suyos. Guardamos `conversation_id` para poder listar con
 * contexto sin recorrer el mensaje original.
 */
@Entity('saved_messages')
@Unique(['userId', 'messageId'])
export class SavedMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
