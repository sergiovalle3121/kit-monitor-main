import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Etiqueta/carpeta personal de una conversación. Es POR USUARIO: cada quien
 * organiza su bandeja a su gusto sin afectar a los demás miembros. Una
 * conversación puede tener varias etiquetas (relación N:M aplanada).
 */
@Entity('conversation_labels')
@Unique(['userId', 'conversationId', 'label'])
export class ConversationLabel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar', length: 40 })
  label: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
