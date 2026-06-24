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

export type MessageType = 'text' | 'image' | 'file' | 'call' | 'poll';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

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
   * Archivo genérico adjunto (PDF, Word, Excel, zip…) para mensajes de
   * `type: 'file'`. Mismo enfoque que las imágenes: el binario vive en Postgres
   * (`bytea`) con `select: false` para no traerlo en las listas. Para migrar a
   * S3/Cloudinary luego, basta cambiar `fileData` por una URL.
   */
  @Column({ name: 'file_data', type: 'bytea', nullable: true, select: false })
  fileData: Buffer | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'file_mime', type: 'varchar', length: 150, nullable: true })
  fileMime: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  /**
   * IDs de usuarios mencionados (@username) resueltos contra los miembros de la
   * conversación. `simple-array` → columna `text` en Postgres/SQLite (aditiva).
   */
  @Column({ name: 'mentioned_user_ids', type: 'simple-array', nullable: true })
  mentionedUserIds: string[] | null;

  /** Mensaje al que este responde (cita), o null. */
  @Index()
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;

  /** Cuándo se editó por última vez (null = no editado). */
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  /** Borrado lógico: si está, el mensaje se muestra como "eliminado". */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  /** Cuándo se fijó (null = no fijado). */
  @Column({ name: 'pinned_at', type: 'timestamptz', nullable: true })
  pinnedAt: Date | null;

  /** Marca de mensaje reenviado (para mostrar "Reenviado"). */
  @Column({ type: 'boolean', default: false })
  forwarded: boolean;

  /** Caducidad (mensajes temporales): si pasa, el mensaje se elimina solo. */
  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
