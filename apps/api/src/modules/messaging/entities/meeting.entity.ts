import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type MeetingRecurrence = 'none' | 'daily' | 'weekly';

/**
 * Reunión/llamada programada en una conversación. "Unirse" inicia una llamada
 * WebRTC normal en esa conversación. El barrido del servicio emite un
 * recordatorio cuando se acerca la hora (una sola vez por ocurrencia) y, si es
 * recurrente, adelanta `start_at` a la siguiente ocurrencia.
 */
@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Index()
  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'duration_min', type: 'int', default: 30 })
  durationMin: number;

  @Column({ type: 'varchar', length: 12, default: 'none' })
  recurrence: MeetingRecurrence;

  /** Cuándo se envió el recordatorio de la ocurrencia actual (null = pendiente). */
  @Column({ name: 'reminded_at', type: 'timestamptz', nullable: true })
  remindedAt: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
