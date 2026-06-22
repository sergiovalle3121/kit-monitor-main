import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';
import { DATE_COLUMN_TYPE } from '../../../common/database/date-column-type';

/**
 * Buzón de notificaciones POR USUARIO (persistente, server-side). A diferencia del
 * centro de notificaciones que deriva eventos vivos del piso (andon/holds/NCR…),
 * esto guarda avisos dirigidos a un usuario con estado de leído real (`readAt`),
 * que sobrevive a refrescos y se sincroniza entre dispositivos. Aditivo y
 * tenant-scoped. `dedupeKey` evita duplicados al re-emitir el mismo aviso.
 */
@Entity('user_notifications')
@Index('idx_user_notif_scope', ['tenant_id', 'userId', 'readAt'])
export class UserNotification extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string; // destinatario (req.user.userId)

  @Column({ type: 'varchar', length: 24, default: 'system' })
  kind: string; // andon | hold | approval | ncr | chat | admin | system

  @Column({ type: 'varchar', length: 12, default: 'info' })
  severity: string; // critical | high | medium | low | info

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  domain: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  href: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true, name: 'dedupe_key' })
  dedupeKey: string | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'read_at' })
  readAt: Date | null;

  @Column({ type: DATE_COLUMN_TYPE, nullable: true, name: 'archived_at' })
  archivedAt: Date | null;
}
