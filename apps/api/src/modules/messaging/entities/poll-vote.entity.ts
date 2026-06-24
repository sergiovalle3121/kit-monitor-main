import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Voto a una opción de una encuesta (mensaje `type: 'poll'`). Un usuario puede
 * votar varias opciones solo si la encuesta es de selección múltiple; el toggle
 * y la unicidad por (mensaje, usuario, opción) lo garantizan.
 */
@Entity('poll_votes')
@Unique(['messageId', 'userId', 'optionId'])
export class PollVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'option_id', type: 'varchar', length: 40 })
  optionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
