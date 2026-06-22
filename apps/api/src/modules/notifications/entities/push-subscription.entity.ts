import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Suscripción de Web Push de un navegador concreto de un usuario. La devuelve
 * `PushManager.subscribe()` en el cliente (endpoint + claves p256dh/auth) y nos
 * permite empujar avisos del buzón aunque la pestaña esté cerrada. Aditiva y
 * tenant-scoped. Una fila por (navegador, usuario): el `endpoint` es único — si
 * el navegador re-suscribe, se actualiza la fila existente. Las suscripciones
 * muertas (404/410 al enviar) se purgan solas.
 */
@Entity('push_subscriptions')
@Index('idx_push_sub_scope', ['tenant_id', 'userId'])
export class PushSubscription extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string; // destinatario (req.user.userId)

  @Index('idx_push_sub_endpoint', { unique: true })
  @Column({ type: 'varchar', length: 512 })
  endpoint: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ type: 'varchar', length: 255 })
  auth: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
  userAgent: string | null;
}
