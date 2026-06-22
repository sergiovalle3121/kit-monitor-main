import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReadinessSummary } from '@axos/contracts';

import { Plan, PlanStatus } from '../plans/entities/plan.entity';
import { PlansService } from '../plans/plans.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

/** Plan statuses that count as "activo" for the scan (V3). */
const ACTIVE_STATUSES: PlanStatus[] = ['published', 'released', 'active'];

interface ReadinessVerdict {
  /** Entity `severity` vocab is critical|high|medium|low|info (there is no 'warning'). */
  severity: 'critical' | 'high';
  title: string;
  body: string;
}

/**
 * Motor de alertas de readiness → buzón.
 *
 * El semáforo Clear-to-Build ya lo computa el sistema (`deriveReadiness`, vía
 * `PlansService.computeReadiness`), pero hasta ahora vivía solo como dato en
 * pantalla: nadie recibía un aviso proactivo. Este servicio cierra ese lazo —
 * escanea los planes activos, evalúa readiness con la lógica EXISTENTE y, para
 * los que están en rojo o con fecha compromiso en riesgo, crea UNA notificación
 * deduplicada al dueño del plan.
 *
 * Implementación de referencia de un "alerts engine" extensible: por ahora solo
 * readiness y UN destinatario (el dueño), para mantenerlo acotado y deduplicable.
 * Multi-destinatario por rol y más condiciones (contratos, inventario…) son
 * follow-ups; la forma del método ya lo permite.
 *
 * Tenancy (V2): igual que el seed de notificaciones, esto corre FUERA de un
 * request, sin contexto de tenant. `NotificationsService.create` y el repo
 * tenant-scoped están diseñados para ese caso (tenant nulo); los planes no son
 * tenant-scoped (no tienen columna `tenant_id`), así que la notificación nula de
 * tenant es consistente y la ve el dueño por la rama `tenant_id IS NULL` de
 * `list()`. No se fuerza ningún contexto de tenant.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  /** Due-date dentro de N días = en riesgo. Configurable; default conservador 3. */
  private readonly dueSoonDays = AlertsService.resolveDueSoonDays();

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly plans: PlansService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  /**
   * Escanea los planes activos, evalúa readiness reusando la vía existente y crea
   * UNA notificación deduplicada por plan/día para los que están en rojo o con la
   * fecha compromiso en riesgo. Todo testeable: sin DB real, mockeando el repo de
   * planes, `PlansService.computeReadiness` y `NotificationsService.create`.
   *
   * `notified` = alertas despachadas al buzón en esta corrida. La deduplicación
   * (por `dedupe_key`) vive en `NotificationsService.create`, de modo que una
   * segunda corrida el mismo día reusa la fila existente: no se duplica.
   */
  async scanReadinessAndNotify(): Promise<{ scanned: number; notified: number }> {
    const plans = await this.planRepo.find({ where: { status: In(ACTIVE_STATUSES) } });
    const day = AlertsService.ymd(new Date());
    let notified = 0;

    for (const plan of plans) {
      try {
        const readiness = await this.plans.computeReadiness(plan);
        const verdict = this.evaluate(plan, readiness);
        if (!verdict) continue;

        const userId = await this.resolveOwnerUserId(plan);
        if (!userId) {
          this.logger.debug(
            `Plan ${plan.id} en riesgo pero sin dueño resoluble ` +
              `(owner='${plan.publishedBy ?? plan.releasedBy ?? '∅'}'); se omite.`,
          );
          continue;
        }

        await this.notifications.create({
          userId,
          kind: 'system',
          severity: verdict.severity,
          domain: 'planning',
          source: 'alerts:readiness',
          title: verdict.title,
          body: verdict.body,
          href: '/dashboard/production-plan',
          // UNA alerta por plan por día (no en cada corrida): el dedupe lo aplica
          // NotificationsService.create contra esta llave.
          dedupeKey: `readiness:plan:${plan.id}:${day}`,
        });
        notified++;
      } catch (err) {
        this.logger.warn(
          `Alerta de readiness falló para el plan ${plan?.id}: ${(err as Error)?.message}`,
        );
      }
    }

    return { scanned: plans.length, notified };
  }

  /**
   * Decide si un plan merece alerta y con qué severidad/mensaje. Devuelve `null`
   * cuando está sano (ni rojo ni due-date en riesgo).
   *
   * Mapeo de severidad (documentado — el vocab de la entidad es
   * critical|high|medium|low|info, NO 'warning'):
   *   - `critical`: bloqueo duro / ya fallando → materiales en rojo, calidad en
   *     rojo, o fecha compromiso vencida.
   *   - `high`: aviso temprano → vence dentro de N días (aún no vencida) y sin
   *     ninguna condición crítica.
   */
  private evaluate(plan: Plan, r: ReadinessSummary): ReadinessVerdict | null {
    const daysToDue = r.detail?.daysToDue ?? null;
    const materialsRed = r.materials === 'red';
    const qualityRed = r.quality === 'red';
    const overdue = daysToDue != null && daysToDue < 0;
    const dueSoon = daysToDue != null && daysToDue >= 0 && daysToDue <= this.dueSoonDays;
    const anyRed = materialsRed || qualityRed || r.shipping === 'red';

    if (!anyRed && !dueSoon) return null;

    const critical = materialsRed || qualityRed || overdue;
    const severity: ReadinessVerdict['severity'] = critical ? 'critical' : 'high';

    const model = plan.model ?? `Plan ${plan.id}`;
    let title: string;
    if (materialsRed) title = `Faltan materiales para ${model}`;
    else if (qualityRed) title = `Calidad detiene ${model}`;
    else if (overdue) title = `${model} con fecha compromiso vencida`;
    else title = `${model} próximo a vencer`;

    // El detalle de `deriveReadiness` ya trae razones en español; las reusamos.
    const reasons = r.detail?.reasons?.length
      ? r.detail.reasons.join(' ')
      : 'Plan sin clear-to-build.';
    const wo = plan.workOrder ? `WO ${plan.workOrder}: ` : '';

    return { severity, title, body: `${wo}${reasons}` };
  }

  /**
   * El destinatario del buzón es un `user.id` (uuid). El dueño del plan
   * (`publishedBy`, fallback `releasedBy`) se guarda como el actor —típicamente
   * un EMAIL (`req.user.email`)— así que lo resolvemos a su `user.id`. Si no es
   * un email (p.ej. el literal 'system' o un nombre legacy) no hay a quién
   * entregar: se omite (cuenta como escaneado, no notificado).
   */
  private async resolveOwnerUserId(plan: Plan): Promise<string | null> {
    const owner = (plan.publishedBy ?? plan.releasedBy ?? '').trim();
    if (!owner || !owner.includes('@')) return null;
    const user = await this.users.findOneByEmail(owner);
    return user?.id ?? null;
  }

  /** YYYY-MM-DD local — frontera de día para el dedupe (UNA alerta por plan/día). */
  private static ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private static resolveDueSoonDays(): number {
    const n = Number(process.env.ALERTS_READINESS_DUE_SOON_DAYS);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  }
}
