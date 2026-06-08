import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export type MessageType = 'text' | 'image';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Index()
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /**
   * Imagen comprimida guardada en Postgres (bytea). Desacoplado a propósito:
   * para migrar a Cloudinary/S3 luego, basta cambiar imageData por una URL.
   * `select: false` evita traer el binario en cada query de lista de mensajes.
   */
  @Column({ name: 'image_data', type: 'bytea', nullable: true, select: false })
  imageData: Buffer | null;

  @Column({ name: 'image_mime', type: 'varchar', length: 100, nullable: true })
  imageMime: string | null;

  @Column({ name: 'image_size', type: 'int', nullable: true })
  imageSize: number | null;

  /**
   * IDs de usuarios mencionados (@username) resueltos contra los miembros de la
   * conversación. `simple-array` → columna `text` en Postgres/SQLite (aditiva).
   */
  @Column({ name: 'mentioned_user_ids', type: 'simple-array', nullable: true })
  mentionedUserIds: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
