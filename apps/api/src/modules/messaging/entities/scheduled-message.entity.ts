import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Mensaje de texto programado para enviarse en `sendAt`. Un intervalo del
 * servidor revisa los vencidos, los envía como mensajes normales y borra la fila.
 */
@Entity('scheduled_messages')
export class ScheduledMessage {
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

  @Column({ type: 'text' })
  body: string;

  @Index()
  @Column({ name: 'send_at', type: 'timestamptz' })
  sendAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
