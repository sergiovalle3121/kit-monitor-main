import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { EventLedgerService } from '../../modules/event-ledger/event-ledger.service';
import { EventDomain } from '../../modules/event-ledger/entities/ledger-event.entity';
import { SignalGateway } from '../gateway/signal.gateway';
import { TenantContextService } from '../services/tenant-context.service';

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Maps the first URL segment after /api/ to an EventDomain */
const SEGMENT_TO_DOMAIN: Record<string, EventDomain> = {
  plans:                 EventDomain.PLANNING,
  'decision-intelligence': EventDomain.PLANNING,
  kits:                  EventDomain.MATERIALS,
  'kit-materials':       EventDomain.MATERIALS,
  advances:              EventDomain.MATERIALS,
  resupplies:            EventDomain.MATERIALS,
  receiving:             EventDomain.MATERIALS,
  inventory:             EventDomain.MATERIALS,
  shipping:              EventDomain.SHIPPING,
  'production-runtime':  EventDomain.PRODUCTION,
  quality:               EventDomain.QUALITY,
  ncr:                   EventDomain.QUALITY,
  suppliers:             EventDomain.QUALITY,
  bom:                   EventDomain.ENGINEERING,
  'bay-layout':          EventDomain.ENGINEERING,
  'visual-aids':         EventDomain.ENGINEERING,
  'enterprise-campus':   EventDomain.SYSTEM,
  governance:            EventDomain.SYSTEM,
  users:                 EventDomain.SYSTEM,
  auth:                  EventDomain.SYSTEM,
};

/** Maps the URL segment to a canonical entity name for referenceType */
const SEGMENT_TO_ENTITY: Record<string, string> = {
  plans:                 'PLAN',
  kits:                  'KIT',
  'kit-materials':       'KIT_MATERIAL',
  advances:              'ADVANCE',
  resupplies:            'RESUPPLY',
  receiving:             'RECEIVING_RECORD',
  inventory:             'INVENTORY_POSITION',
  shipping:              'SHIPMENT',
  'production-runtime':  'PRODUCTION_EVENT',
  quality:               'QUALITY_RECORD',
  ncr:                   'NCR',
  bom:                   'BOM_ITEM',
  'bay-layout':          'BAY_LAYOUT',
  'visual-aids':         'VISUAL_AID',
  suppliers:             'SUPPLIER',
  'enterprise-campus':   'ENTERPRISE_RECORD',
  governance:            'GOVERNANCE_RECORD',
  users:                 'USER',
};

const HTTP_METHOD_TO_VERB: Record<string, string> = {
  POST:   'CREATED',
  PATCH:  'UPDATED',
  PUT:    'UPDATED',
  DELETE: 'DELETED',
};

/**
 * Segments that warrant a real-time broadcast when mutated.
 * Critical domains: PRODUCTION writes and QUALITY NCRs are the most
 * time-sensitive for the shopfloor HUD.
 */
const CRITICAL_BROADCAST_SEGMENTS = new Set([
  'production-runtime',
  'ncr',
  'autopilot',
  'plans',
]);

/**
 * Global interceptor that automatically records mutation events (POST, PATCH, PUT, DELETE)
 * on tracked domains into the immutable LedgerEvent audit trail, and broadcasts
 * critical events via the SignalGateway WebSocket for the live Autopilot HUD.
 */
@Injectable()
export class EventLedgerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(EventLedgerInterceptor.name);

  constructor(
    private readonly ledger: EventLedgerService,
    @Optional() private readonly signals: SignalGateway,
    @Optional() private readonly tenantCtx: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req  = http.getRequest<Request>();
    const { method, path, body, params } = req;

    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    // Resolve path segment — strip /api/ prefix and split
    const firstSegment = path.replace(/^\/api\//, '').split('/')[0];
    const domain = SEGMENT_TO_DOMAIN[firstSegment];

    if (!domain) {
      return next.handle();
    }

    // Actor from Passport JWT guard (set by JwtAuthGuard)
    const user = (req as any).user as Record<string, any> | undefined;
    const actorId   = user?.userId?.toString() ?? user?.id?.toString();
    const actorName = user?.username ?? user?.email;

    // Reference extraction: path param :id takes priority, then body id
    const referenceId   = params?.id ?? body?.id;
    const entityName    = SEGMENT_TO_ENTITY[firstSegment]
                          ?? firstSegment.toUpperCase().replace(/-/g, '_');
    const action        = `${entityName}_${HTTP_METHOD_TO_VERB[method] ?? 'MUTATED'}`;

    // Deep-clone request body to capture pre-handler state for diffs
    const beforeState = (method === 'PATCH' || method === 'PUT')
      ? JSON.parse(JSON.stringify(body ?? {}))
      : undefined;

    const t0 = Date.now();

    return next.handle().pipe(
      tap(async (responseData: Record<string, any> | null) => {
        try {
          await this.ledger.recordEvent({
            actorId,
            actorName,
            domain,
            action,
            referenceType: entityName,
            referenceId:   (referenceId ?? responseData?.id)?.toString(),
            model:         body?.model   ?? responseData?.model,
            workOrder:     body?.workOrder ?? responseData?.workOrder,
            program:       body?.program  ?? responseData?.program,
            line:          body?.line?.toString() ?? responseData?.line?.toString(),
            plant:         body?.building ?? body?.plant ?? responseData?.building,
            metadata: {
              beforeState,
              afterState:  responseData,
              durationMs:  Date.now() - t0,
              httpMethod:  method,
              path,
            },
          });
        } catch (err: any) {
          // Ledger write failures must never break the business operation
          this.logger.warn(
            `EventLedger write skipped for [${domain}] ${action}: ${err?.message}`,
          );
        }

        // Broadcast critical events to the live HUD via WebSocket
        if (this.signals && CRITICAL_BROADCAST_SEGMENTS.has(firstSegment)) {
          try {
            const tenantId =
              this.tenantCtx?.get()?.buildings?.[0] ??
              body?.building ?? body?.tenantId ??
              responseData?.building ?? responseData?.tenantId ??
              'default';

            this.signals.emitCriticalEvent(tenantId, {
              domain,
              action,
              referenceId: (referenceId ?? responseData?.id)?.toString(),
              actor:       actorName,
              line:        body?.line?.toString() ?? responseData?.line?.toString(),
              model:       body?.model ?? responseData?.model,
              metadata: {
                httpMethod: method,
                path,
                durationMs: Date.now() - t0,
              },
            });
          } catch (err: any) {
            // Signal emit failures must never break the business operation
            this.logger.debug(`Signal emit skipped: ${err?.message}`);
          }
        }
      }),
    );
  }
}
