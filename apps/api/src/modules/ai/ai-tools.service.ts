import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { User } from '../users/entities/user.entity';
import { InventoryService } from '../inventory/inventory.service';
import { PlansService } from '../plans/plans.service';
import { BomService } from '../bom/bom.service';
import { QualityService } from '../quality/quality.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { EnterpriseCampusService } from '../enterprise-campus/enterprise-campus.service';
import { ErpFinService } from '../erp-core/services/erp-fin.service';
import { ErpMmService } from '../erp-core/services/erp-mm.service';
import { ErpSdService } from '../erp-core/services/erp-sd.service';
import { ErpPpService } from '../erp-core/services/erp-pp.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { SemanticService } from '../semantic/semantic.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AutopilotService } from '../autopilot/autopilot.service';
import { DecisionIntelligenceService } from '../decision-intelligence/decision-intelligence.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { EhsService } from '../ehs/ehs.service';
import { FaiService } from '../fai/fai.service';
import { VisualAidsService } from '../visual-aids/visual-aids.service';
import { ShippingService } from '../shipping/shipping.service';
import { ToolingService } from '../tooling/tooling.service';
import { RmaService } from '../rma/rma.service';
import { FixedAssetsService } from '../fixed-assets/fixed-assets.service';
import { GenealogyService } from '../genealogy/genealogy.service';
import { ACTIONS, ACTION_KEYS } from './ai-actions';
import { CideToolSpec } from './cide-provider';

/** JSON-Schema shape for a tool input (OpenAI/Anthropic-compatible). */
export interface JsonObjectSchema {
  type: 'object';
  properties: Record<
    string,
    { type: string; description?: string; enum?: string[] }
  >;
  required?: string[];
  // Index signature so this is structurally assignable to the engine's schema type.
  [key: string]: unknown;
}

/** Internal tool spec (Anthropic-style `input_schema`; mapped to OpenAI `parameters`). */
export interface AiToolSpec {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
}

export interface ToolContext {
  user: User;
  isAdmin: boolean;
  permissions: string[];
}

interface AiToolDef extends AiToolSpec {
  /** resource:action string the caller must hold (admin bypasses). Null = any user. */
  requiredPermission: string | null;
  /** Substrings that route the demo (no-key) mode to this tool. */
  mockTriggers: string[];
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function clip(data: unknown, n = 50): unknown {
  return Array.isArray(data) ? data.slice(0, n) : data;
}

function schema(
  properties: JsonObjectSchema['properties'] = {},
  required: string[] = [],
): JsonObjectSchema {
  return { type: 'object', properties, required };
}

/** Best-effort tenant of the caller (falls back to the service default). */
function tenantOf(ctx: ToolContext): string | undefined {
  return (ctx.user as { tenant_id?: string | null }).tenant_id ?? undefined;
}

/**
 * The grounding layer: read-only tools over the real MES + ERP services. Tools
 * are filtered by the caller's RBAC permissions BEFORE being offered to the
 * model, and re-checked at execution — so the copilot can never read data the
 * user couldn't read in the UI.
 */
@Injectable()
export class AiToolsService {
  constructor(private readonly moduleRef: ModuleRef) {}

  private svc<T>(type: Type<T>): T {
    return this.moduleRef.get(type, { strict: false });
  }

  private allowed(def: AiToolDef, ctx: ToolContext): boolean {
    if (ctx.isAdmin) return true;
    if (!def.requiredPermission) return true;
    return ctx.permissions.includes(def.requiredPermission);
  }

  /**
   * Tool specs (OpenAI function-calling shape) the caller is allowed to use.
   * Internally the defs carry an Anthropic-style `input_schema`; we expose it as
   * `parameters` so CIDE's OpenAI-compatible engine can consume it directly.
   */
  toolSpecs(ctx: ToolContext): CideToolSpec[] {
    return this.defs()
      .filter((d) => this.allowed(d, ctx))
      .map(({ name, description, input_schema }) => ({
        name,
        description,
        parameters: input_schema,
      }));
  }

  /** Execute a tool by name, re-checking the permission gate. */
  async execute(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<unknown> {
    const def = this.defs().find((d) => d.name === name);
    if (!def) return { error: `Unknown tool: ${name}` };
    if (!this.allowed(def, ctx)) {
      return { error: 'No tienes permiso para consultar esta información.' };
    }
    try {
      return await def.run(input ?? {}, ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: `La consulta falló: ${message}` };
    }
  }

  /** Pick up to two allowed tools for the demo (no-key) provider. */
  pickMockTools(message: string, ctx: ToolContext): AiToolDef[] {
    const text = message.toLowerCase();
    // Match a trigger only at a word boundary so e.g. "inventario" does not
    // match the "venta" trigger. Demo-only heuristic; the real model does
    // proper tool selection.
    const startsWord = (t: string): boolean => {
      let from = 0;
      for (;;) {
        const idx = text.indexOf(t, from);
        if (idx < 0) return false;
        const before = idx === 0 ? '' : text[idx - 1];
        if (!/[a-záéíóúñ]/.test(before)) return true;
        from = idx + 1;
      }
    };
    const allowed = this.defs().filter((d) => this.allowed(d, ctx));
    const hits = allowed.filter((d) => d.mockTriggers.some(startsWord));
    const chosen = hits.length ? hits : allowed.slice(0, 1);
    return chosen.slice(0, 2);
  }

  private defs(): AiToolDef[] {
    return [
      {
        name: 'company_overview',
        description:
          'Resumen ejecutivo del estado de la planta (KPIs de producción, inventario, calidad). Úsalo para preguntas generales de "cómo va todo".',
        requiredPermission: null,
        mockTriggers: [
          'resumen',
          'overview',
          'estado',
          'general',
          'kpi',
          'cómo va',
          'como va',
          'situaci',
          'planta',
        ],
        input_schema: schema(),
        run: () =>
          this.svc(EnterpriseCampusService)
            .getCampusState()
            .then((d) => clip(d)),
      },
      {
        name: 'operations_pulse',
        description:
          'Pulso operacional sobre el Event Ledger inmutable: agrega la actividad reciente (eventos por dominio, acción y línea) en una ventana de tiempo. Úsalo para "¿qué ha pasado / qué cambió / dónde hay más actividad?", detectar picos de incidentes o comparar líneas/programas. Filtros: domain, line, program, sinceHours (default 24, máx 720), limit.',
        requiredPermission: null,
        mockTriggers: [
          'qué pasó',
          'que paso',
          'qué ha pasado',
          'actividad',
          'pulso',
          'tendencia',
          'cambió',
          'cambio',
          'movimiento',
          'bitácora',
          'bitacora',
          'ledger',
          'eventos',
        ],
        input_schema: schema({
          domain: {
            type: 'string',
            description:
              'Dominio del evento: MATERIALS, PLANNING, PRODUCTION, ENGINEERING, QUALITY, SHIPPING o SYSTEM.',
            enum: [
              'MATERIALS',
              'PLANNING',
              'PRODUCTION',
              'ENGINEERING',
              'QUALITY',
              'SHIPPING',
              'SYSTEM',
            ],
          },
          line: { type: 'string', description: 'Línea de producción' },
          program: { type: 'string', description: 'Programa / proyecto' },
          sinceHours: {
            type: 'number',
            description: 'Ventana hacia atrás en horas (default 24, máx 720)',
          },
        }),
        run: (i) =>
          this.svc(EventLedgerService).summarizeActivity({
            domain: str(i.domain),
            line: str(i.line),
            program: str(i.program),
            sinceHours:
              typeof i.sinceHours === 'number' ? i.sinceHours : undefined,
          }),
      },
      {
        name: 'ledger_trace',
        description:
          'Trazabilidad cuna-a-tumba: historial cronológico de eventos del ledger para una orden de trabajo (workOrder) o para una entidad específica (referenceType + referenceId, p. ej. KIT, SERIAL, MATERIAL). Úsalo para auditar "qué le pasó a esta WO/serial/kit y cuándo".',
        requiredPermission: null,
        mockTriggers: [
          'trazabilidad',
          'historial',
          'genealog',
          'rastrea',
          'auditor',
          'qué le pasó',
          'que le paso',
        ],
        input_schema: schema({
          workOrder: {
            type: 'string',
            description: 'Número de orden de trabajo a rastrear',
          },
          referenceType: {
            type: 'string',
            description: 'Tipo de entidad (KIT, SERIAL, MATERIAL, WORK_ORDER…)',
          },
          referenceId: {
            type: 'string',
            description: 'ID de la entidad a rastrear (requiere referenceType)',
          },
        }),
        run: async (i) => {
          const ledger = this.svc(EventLedgerService);
          const wo = str(i.workOrder);
          const refType = str(i.referenceType);
          const refId = str(i.referenceId);
          if (refType && refId) {
            return clip(await ledger.getEventsByReference(refType, refId), 80);
          }
          if (wo) {
            return clip(await ledger.getEventsByWorkOrder(wo), 80);
          }
          return {
            error:
              'Indica una orden de trabajo (workOrder) o un par referenceType + referenceId para rastrear.',
          };
        },
      },
      {
        name: 'list_metrics',
        description:
          'Catálogo semántico de métricas/KPIs de la empresa: clave, nombre, unidad, dominio y definición. Úsalo para saber qué se puede medir antes de pedir un valor.',
        requiredPermission: null,
        mockTriggers: [
          'métrica',
          'metrica',
          'kpi',
          'indicador',
          'catálogo',
          'catalogo',
          'qué puedo medir',
          'que puedo medir',
        ],
        input_schema: schema(),
        run: (_i, ctx) =>
          this.svc(SemanticService)
            .listMetrics(tenantOf(ctx))
            .then((d) => clip(d, 60)),
      },
      {
        name: 'metric_value',
        description:
          'Valor actual de una métrica del catálogo por su clave (key), p. ej. inventory_value, active_quality_holds, open_sales_orders, suppliers_count, mrp_runs, ledger_events_24h. Respeta los permisos del usuario.',
        requiredPermission: null,
        mockTriggers: ['valor de', 'cuánto', 'cuanto', 'oee', 'otd'],
        input_schema: schema(
          {
            key: {
              type: 'string',
              description:
                'Clave de la métrica (usa list_metrics para descubrirlas).',
            },
          },
          ['key'],
        ),
        run: (i, ctx) => {
          const key = str(i.key);
          if (!key) {
            return Promise.resolve({
              error:
                'Indica la clave (key) de la métrica, p. ej. inventory_value.',
            });
          }
          return this.svc(SemanticService).resolveMetric(
            { isAdmin: ctx.isAdmin, permissions: ctx.permissions },
            key,
            tenantOf(ctx),
          );
        },
      },
      {
        name: 'kpi_alerts',
        description:
          'Alertas proactivas de KPIs: métricas que cruzan su objetivo (target) o que muestran una tendencia adversa, con severidad (warning/critical). Úsalo para "¿qué KPIs están fuera de objetivo / en alerta / empeorando?".',
        requiredPermission: null,
        mockTriggers: [
          'alerta',
          'fuera de objetivo',
          'en rojo',
          'empeorando',
          'objetivo',
          'umbral',
          'en riesgo',
        ],
        input_schema: schema(),
        run: (_i, ctx) =>
          this.svc(SemanticService).evaluateAlerts(
            { isAdmin: ctx.isAdmin, permissions: ctx.permissions },
            tenantOf(ctx),
          ),
      },
      {
        name: 'analyze_trend',
        description:
          'Tendencia de actividad en el tiempo a partir del Event Ledger: serie diaria de eventos, variación semana-contra-semana y una narrativa. Úsalo para preguntas de evolución/tendencia ("¿cómo ha ido…?", "¿subió o bajó…?"). Filtros: days (1–90, default 14), domain.',
        requiredPermission: null,
        mockTriggers: [
          'tendencia',
          'evolución',
          'evolucion',
          'cómo ha ido',
          'como ha ido',
          'subió',
          'subio',
          'bajó',
          'bajo',
          'últimos días',
          'ultimos dias',
          'semana',
        ],
        input_schema: schema({
          days: {
            type: 'number',
            description: 'Días hacia atrás (1–90, default 14)',
          },
          domain: {
            type: 'string',
            description:
              'Dominio del evento: MATERIALS, PLANNING, PRODUCTION, ENGINEERING, QUALITY, SHIPPING o SYSTEM.',
            enum: [
              'MATERIALS',
              'PLANNING',
              'PRODUCTION',
              'ENGINEERING',
              'QUALITY',
              'SHIPPING',
              'SYSTEM',
            ],
          },
        }),
        run: (i) =>
          this.svc(AnalyticsService).ledgerTrend({
            days: typeof i.days === 'number' ? i.days : undefined,
            domain: str(i.domain),
          }),
      },
      {
        name: 'object_insight',
        description:
          'Drill-down de un objeto del negocio (ontología): actividad reciente, tendencia, métricas relacionadas, vínculos y entidades recientes. objectKey: WorkOrder, Material, Supplier, BOM, QualityHold, Customer o LedgerEvent. Úsalo para "analiza/explora <objeto>".',
        requiredPermission: null,
        mockTriggers: [
          'objeto',
          'explora',
          'analiza el',
          'detalle de',
          'drill',
        ],
        input_schema: schema(
          {
            objectKey: {
              type: 'string',
              description:
                'Clave del objeto: WorkOrder, Material, Supplier, BOM, QualityHold, Customer, LedgerEvent.',
            },
          },
          ['objectKey'],
        ),
        run: (i, ctx) => {
          const objectKey = str(i.objectKey);
          if (!objectKey) {
            return Promise.resolve({
              error: 'Indica el objeto (objectKey), p. ej. WorkOrder.',
            });
          }
          return this.svc(AnalyticsService).objectInsight(
            { isAdmin: ctx.isAdmin, permissions: ctx.permissions },
            objectKey,
            tenantOf(ctx),
          );
        },
      },
      {
        name: 'simulate_projection',
        description:
          'Simulación what-if: proyecta la actividad a futuro a partir de su tendencia y un ajuste hipotético (adjustmentPct). Úsalo para "¿qué pasaría si…?", escenarios y proyecciones. Filtros: domain, horizonDays (1–30), adjustmentPct (−100 a 200).',
        requiredPermission: null,
        mockTriggers: [
          'qué pasaría',
          'que pasaria',
          'what if',
          'simula',
          'escenario',
          'proyecta',
          'a futuro',
        ],
        input_schema: schema({
          domain: {
            type: 'string',
            description:
              'Dominio: MATERIALS, PLANNING, PRODUCTION, ENGINEERING, QUALITY, SHIPPING o SYSTEM.',
            enum: [
              'MATERIALS',
              'PLANNING',
              'PRODUCTION',
              'ENGINEERING',
              'QUALITY',
              'SHIPPING',
              'SYSTEM',
            ],
          },
          horizonDays: {
            type: 'number',
            description: 'Horizonte de proyección en días (1–30, default 7)',
          },
          adjustmentPct: {
            type: 'number',
            description:
              'Ajuste hipotético al ritmo proyectado, en % (−100 a 200, default 0)',
          },
        }),
        run: (i) =>
          this.svc(AnalyticsService).project({
            domain: str(i.domain),
            horizonDays:
              typeof i.horizonDays === 'number' ? i.horizonDays : undefined,
            adjustmentPct:
              typeof i.adjustmentPct === 'number' ? i.adjustmentPct : undefined,
          }),
      },
      {
        name: 'autopilot_proposals',
        description:
          'Acciones correctivas que el sistema (Autopilot) recomienda: cuellos de botella, rebalanceo de WIP, resurtido, auditorías de estabilidad. Cada propuesta trae título, descripción, severidad (low/medium/high/critical) y línea/modelo. Úsalo para "¿qué acciones me recomienda el sistema?" o "¿qué debo atender primero?". Filtro: status (pending por defecto).',
        // Gated to ADMIN_ACCESS to match the /api/autopilot/proposals endpoint.
        requiredPermission: 'ADMIN_ACCESS',
        mockTriggers: [
          'recomienda',
          'recomendaci',
          'acción',
          'accion',
          'qué hago',
          'que hago',
          'atender',
          'propuesta',
          'autopilot',
          'sugerencia',
        ],
        input_schema: schema({
          status: {
            type: 'string',
            enum: ['pending', 'executed', 'dismissed', 'expired'],
            description: 'Estado de la propuesta (default pending).',
          },
        }),
        run: (i, ctx) =>
          this.svc(AutopilotService)
            .listProposals(str(i.status) ?? 'pending', tenantOf(ctx))
            .then((d) => clip(d, 50)),
      },
      {
        name: 'decision_scenarios',
        description:
          'Escenarios de planeación de Decision Intelligence (con su corrida de forecast asociada) para comparar alternativas de plan. Úsalo cuando pregunten por escenarios, simulaciones de plan o comparación de planes.',
        requiredPermission: 'planning:read',
        mockTriggers: [
          'escenario',
          'simulaci',
          'plan alterno',
          'comparar plan',
        ],
        input_schema: schema(),
        run: () =>
          this.svc(DecisionIntelligenceService)
            .listPlanScenarios()
            .then((d) => clip(d, 30)),
      },
      {
        name: 'list_inventory',
        description:
          'Existencias de inventario por número de parte y almacén. Filtros opcionales: partNumber, warehouseId, programId.',
        requiredPermission: 'inventory:read',
        mockTriggers: [
          'inventario',
          'stock',
          'existencias',
          'almacen',
          'almacén',
          'disponible',
        ],
        input_schema: schema({
          partNumber: { type: 'string', description: 'Número de parte exacto' },
          warehouseId: { type: 'string', description: 'ID de almacén' },
          programId: { type: 'string', description: 'ID de programa' },
        }),
        run: (i, ctx) =>
          this.svc(InventoryService)
            .findAllPositions(ctx.user, {
              partNumber: str(i.partNumber),
              warehouseId: str(i.warehouseId),
              programId: str(i.programId),
            })
            .then((d) => clip(d, 60)),
      },
      {
        name: 'inventory_valuation',
        description:
          'Valuación del inventario: cantidad, costo unitario y valor total por número de parte.',
        requiredPermission: 'inventory:read',
        mockTriggers: ['valuaci', 'valor de inventario', 'costo de inventario'],
        input_schema: schema(),
        run: () =>
          this.svc(ErpMmService)
            .inventoryValuation()
            .then((d) => clip(d)),
      },
      {
        name: 'list_production_plans',
        description:
          'Planes / órdenes de producción con su estado. Filtros opcionales: model, workOrder, line.',
        requiredPermission: 'production:read',
        mockTriggers: [
          'producci',
          'orden',
          'plan',
          'work order',
          'piso',
          'línea',
          'linea',
        ],
        input_schema: schema({
          model: { type: 'string', description: 'Modelo / producto' },
          workOrder: {
            type: 'string',
            description: 'Número de orden de trabajo',
          },
          line: { type: 'string', description: 'Línea de producción' },
        }),
        run: (i, ctx) =>
          this.svc(PlansService)
            .findAll(
              {
                model: str(i.model),
                workOrder: str(i.workOrder),
                line: str(i.line),
              },
              ctx.user,
            )
            .then((d) => clip(d, 60)),
      },
      {
        name: 'scheduling_intelligence',
        description:
          'Inteligencia de programación: carga por línea, recomendaciones y cuellos de botella.',
        requiredPermission: 'production:read',
        mockTriggers: [
          'cuello',
          'bottleneck',
          'capacidad',
          'programaci',
          'carga',
          'scheduling',
        ],
        input_schema: schema(),
        run: () =>
          this.svc(PlansService)
            .getSchedulingIntelligence()
            .then((d) => clip(d)),
      },
      {
        name: 'list_mrp_runs',
        description: 'Corridas de MRP (planeación de materiales) y su estado.',
        requiredPermission: 'planning:read',
        mockTriggers: ['mrp', 'planeaci', 'corrida', 'explosi'],
        input_schema: schema(),
        run: () =>
          this.svc(ErpPpService)
            .listRuns()
            .then((d) => clip(d)),
      },
      {
        name: 'list_purchase_requisitions',
        description: 'Requisiciones de compra (MM) con su estado.',
        requiredPermission: 'materials:read',
        mockTriggers: ['requisici', 'compra', 'purchase'],
        input_schema: schema({
          status: { type: 'string', description: 'Estado de la requisición' },
        }),
        run: (i) =>
          this.svc(ErpMmService)
            .listRequisitions({ status: str(i.status) })
            .then((d) => clip(d)),
      },
      {
        name: 'supplier_prices',
        description: 'Precios de proveedores para un número de parte.',
        requiredPermission: 'materials:read',
        mockTriggers: ['precio proveedor', 'supplier price', 'costo proveedor'],
        input_schema: schema({
          partNumber: { type: 'string', description: 'Número de parte' },
        }),
        run: (i) =>
          this.svc(ErpMmService)
            .listSupplierPrices(str(i.partNumber))
            .then((d) => clip(d)),
      },
      {
        name: 'trial_balance',
        description:
          'Balanza de comprobación contable. Filtro opcional: period (YYYY-MM).',
        requiredPermission: 'finance:read',
        mockTriggers: ['balanza', 'trial balance', 'comprobaci'],
        input_schema: schema({
          period: { type: 'string', description: 'Periodo YYYY-MM' },
        }),
        run: (i) => this.svc(ErpFinService).trialBalance(str(i.period)),
      },
      {
        name: 'income_statement',
        description:
          'Estado de resultados (P&L). Filtro opcional: period (YYYY-MM).',
        requiredPermission: 'finance:read',
        mockTriggers: [
          'estado de resultados',
          'p&l',
          'utilidad',
          'ganancia',
          'ingresos',
          'resultados',
        ],
        input_schema: schema({
          period: { type: 'string', description: 'Periodo YYYY-MM' },
        }),
        run: (i) => this.svc(ErpFinService).incomeStatement(str(i.period)),
      },
      {
        name: 'balance_sheet',
        description:
          'Balance general (activos, pasivos, capital). Filtro opcional: period.',
        requiredPermission: 'finance:read',
        mockTriggers: [
          'balance general',
          'balance sheet',
          'activos',
          'pasivos',
        ],
        input_schema: schema({
          period: { type: 'string', description: 'Periodo YYYY-MM' },
        }),
        run: (i) => this.svc(ErpFinService).balanceSheet(str(i.period)),
      },
      {
        name: 'ar_ap_aging',
        description:
          'Antigüedad de saldos. kind="AR" para cuentas por cobrar, "AP" para por pagar.',
        requiredPermission: 'finance:read',
        mockTriggers: ['cobrar', 'pagar', 'aging', 'cartera', 'vencido'],
        input_schema: schema(
          {
            kind: {
              type: 'string',
              enum: ['AR', 'AP'],
              description: 'AR o AP',
            },
          },
          ['kind'],
        ),
        run: (i) => {
          const kind = str(i.kind) === 'AP' ? 'AP' : 'AR';
          return this.svc(ErpFinService).aging(kind);
        },
      },
      {
        name: 'list_sales_orders',
        description:
          'Órdenes de venta (SD). Filtros opcionales: status, customerCode.',
        requiredPermission: 'sales:read',
        mockTriggers: ['venta', 'pedido', 'sales order', 'orden de venta'],
        input_schema: schema({
          status: { type: 'string', description: 'Estado de la orden' },
          customerCode: { type: 'string', description: 'Código de cliente' },
        }),
        run: (i) =>
          this.svc(ErpSdService)
            .listSOs({
              status: str(i.status),
              customerCode: str(i.customerCode),
            })
            .then((d) => clip(d)),
      },
      {
        name: 'list_customers',
        description: 'Catálogo de clientes (SD).',
        requiredPermission: 'sales:read',
        mockTriggers: ['cliente', 'customer'],
        input_schema: schema(),
        run: () =>
          this.svc(ErpSdService)
            .listCustomers()
            .then((d) => clip(d)),
      },
      {
        name: 'quality_holds',
        description: 'Retenciones de calidad activas (material bloqueado).',
        requiredPermission: 'quality:read',
        mockTriggers: ['calidad', 'retenci', 'hold', 'bloqueo'],
        input_schema: schema(),
        run: () =>
          this.svc(QualityService)
            .findAllActiveHolds()
            .then((d) => clip(d)),
      },
      {
        name: 'list_capas',
        description:
          'Acciones correctivas (CAPA) de calidad. Filtros: status, partNumber.',
        requiredPermission: 'quality:read',
        mockTriggers: ['capa', 'acción correctiva', 'accion correctiva'],
        input_schema: schema({
          status: { type: 'string', description: 'Estado del CAPA' },
        }),
        run: (i) =>
          this.svc(QualityService)
            .findCapas({ status: str(i.status) })
            .then((d) => clip(d)),
      },
      {
        name: 'list_suppliers',
        description: 'Catálogo de proveedores y su información.',
        requiredPermission: 'materials:read',
        mockTriggers: ['proveedor', 'supplier'],
        input_schema: schema(),
        run: () =>
          this.svc(SuppliersService)
            .findAll()
            .then((d) => clip(d)),
      },
      {
        name: 'bom_headers',
        description:
          'Listas de materiales (BOM) con sus componentes. Filtro opcional: model.',
        requiredPermission: 'engineering:read',
        mockTriggers: [
          'bom',
          'lista de materiales',
          'componente',
          'estructura',
        ],
        input_schema: schema({
          model: { type: 'string', description: 'Modelo / producto' },
        }),
        run: (i) =>
          this.svc(BomService)
            .findAllBomHeaders(str(i.model))
            .then((d) => clip(d, 30)),
      },
      // ── Mantenimiento ──────────────────────────────────────────────────────
      {
        name: 'maintenance_orders',
        description:
          'Órdenes de mantenimiento (correctivo/preventivo) con su estado. Úsalo para "¿qué mantenimientos hay abiertos/vencidos?" o por activo. Filtros: status, type, assetId.',
        requiredPermission: 'maintenance:read',
        mockTriggers: [
          'mantenimiento',
          'avería',
          'averia',
          'orden de mantenimiento',
          'reparaci',
          'correctivo',
        ],
        input_schema: schema({
          status: { type: 'string', description: 'Estado de la orden' },
          type: { type: 'string', description: 'Tipo (correctivo/preventivo)' },
          assetId: { type: 'string', description: 'ID del activo' },
        }),
        run: (i) =>
          this.svc(MaintenanceService)
            .listOrders({
              status: str(i.status),
              type: str(i.type),
              assetId: str(i.assetId),
            })
            .then((d) => clip(d, 60)),
      },
      {
        name: 'maintenance_assets',
        description:
          'Catálogo de activos/equipos mantenibles y su estado operativo. Úsalo para "¿qué equipos hay?" o ver disponibilidad de máquinas.',
        requiredPermission: 'maintenance:read',
        mockTriggers: ['activo', 'equipo', 'máquina', 'maquina', 'asset'],
        input_schema: schema(),
        run: () =>
          this.svc(MaintenanceService)
            .listAssets()
            .then((d) => clip(d, 60)),
      },
      {
        name: 'maintenance_pm_plans',
        description:
          'Planes de mantenimiento preventivo (PM) con su próxima fecha de vencimiento. Úsalo para "¿qué preventivos tocan / están vencidos?". Filtros: assetId, active.',
        requiredPermission: 'maintenance:read',
        mockTriggers: [
          'preventivo',
          'pm',
          'plan de mantenimiento',
          'calendario',
        ],
        input_schema: schema({
          assetId: { type: 'string', description: 'ID del activo' },
          active: { type: 'boolean', description: 'Solo planes activos' },
        }),
        run: (i) =>
          this.svc(MaintenanceService)
            .listPmPlans({
              assetId: str(i.assetId),
              active: typeof i.active === 'boolean' ? i.active : undefined,
            })
            .then((d) => clip(d, 60)),
      },
      // ── EHS / Seguridad ────────────────────────────────────────────────────
      {
        name: 'safety_incidents',
        description:
          'Incidentes de seguridad y medio ambiente (EHS) con su estado, tipo, severidad y CAPA. Úsalo para "¿qué incidentes de seguridad hay?", por área o severidad. Filtros: status, type, severity, area, programId.',
        requiredPermission: 'reports:read',
        mockTriggers: [
          'incidente',
          'seguridad',
          'ehs',
          'accidente',
          'lesión',
          'lesion',
          'casi accidente',
        ],
        input_schema: schema({
          status: { type: 'string', description: 'Estado del incidente' },
          type: { type: 'string', description: 'Tipo de incidente' },
          severity: { type: 'string', description: 'Severidad' },
          area: { type: 'string', description: 'Área' },
        }),
        run: (i) =>
          this.svc(EhsService)
            .list({
              status: str(i.status),
              type: str(i.type),
              severity: str(i.severity),
              area: str(i.area),
            })
            .then((d) => clip(d, 60)),
      },
      // ── Calidad: FAI (Primera Pieza) ───────────────────────────────────────
      {
        name: 'fai_records',
        description:
          'Inspecciones de primera pieza (FAI) por orden de trabajo, con su resultado (pass/fail). Úsalo para "¿qué FAI hay pendientes/rechazadas?". Filtros: woId, result, line.',
        requiredPermission: 'quality:report',
        mockTriggers: [
          'fai',
          'primera pieza',
          'first article',
          'primer artículo',
        ],
        input_schema: schema({
          woId: { type: 'string', description: 'ID de orden de trabajo' },
          result: { type: 'string', description: 'Resultado (pass/fail)' },
          line: { type: 'string', description: 'Línea' },
        }),
        run: (i) =>
          this.svc(FaiService)
            .list({
              woId: str(i.woId),
              result: str(i.result),
              line: str(i.line),
            })
            .then((d) => clip(d, 60)),
      },
      // ── Ayudas visuales / Instrucciones de trabajo ─────────────────────────
      {
        name: 'visual_aids',
        description:
          'Ayudas visuales / instrucciones de trabajo disponibles por modelo o programa. Úsalo para "¿qué instrucciones/ayudas visuales hay para X modelo?". Filtros: model, programId.',
        requiredPermission: null,
        mockTriggers: [
          'ayuda visual',
          'instrucci',
          'work instruction',
          'guía de trabajo',
          'guia de trabajo',
        ],
        input_schema: schema({
          model: { type: 'string', description: 'Modelo / producto' },
          programId: { type: 'string', description: 'ID de programa' },
        }),
        run: (i) =>
          this.svc(VisualAidsService)
            .findAll(str(i.model), str(i.programId))
            .then((d) => clip(d, 60)),
      },
      // ── Logística: Embarques ───────────────────────────────────────────────
      {
        name: 'list_shipments',
        description:
          'Embarques/envíos con su estado y destino. Úsalo para "¿qué embarques hay hoy / pendientes?" y cumplimiento de entregas.',
        requiredPermission: 'materials:read',
        mockTriggers: [
          'embarque',
          'envío',
          'envio',
          'shipment',
          'despacho',
          'entrega',
        ],
        input_schema: schema(),
        run: (_i, ctx) =>
          Promise.resolve(this.svc(ShippingService).findAll(ctx.user)).then(
            (d) => clip(d, 60),
          ),
      },
      // ── Herramentales ──────────────────────────────────────────────────────
      {
        name: 'list_tools',
        description:
          'Herramentales serializados (tooling) y su estado. Úsalo para "¿qué herramentales hay / están en uso / en calibración?". Filtros: status, type.',
        requiredPermission: 'maintenance:read',
        mockTriggers: [
          'herramental',
          'tooling',
          'herramienta',
          'molde',
          'fixture',
        ],
        input_schema: schema({
          status: { type: 'string', description: 'Estado del herramental' },
          type: { type: 'string', description: 'Tipo de herramental' },
        }),
        run: (i) =>
          this.svc(ToolingService)
            .list({ status: str(i.status), type: str(i.type) })
            .then((d) => clip(d, 60)),
      },
      // ── Calidad: RMA / Devoluciones ────────────────────────────────────────
      {
        name: 'rma_cases',
        description:
          'Casos de devolución de cliente (RMA) con su estado. Úsalo para "¿qué devoluciones/RMA hay abiertas?" o por cliente. Filtros: status, customerName.',
        requiredPermission: 'quality:read',
        mockTriggers: ['rma', 'devolución', 'devolucion', 'retorno', 'return'],
        input_schema: schema({
          status: { type: 'string', description: 'Estado del RMA' },
          customerName: { type: 'string', description: 'Nombre del cliente' },
        }),
        run: (i) =>
          this.svc(RmaService)
            .list({
              status: str(i.status),
              customerName: str(i.customerName),
            })
            .then((d) => clip(d, 60)),
      },
      // ── Finanzas: Activos fijos ────────────────────────────────────────────
      {
        name: 'list_fixed_assets',
        description:
          'Activos fijos (capital) con su estado y categoría, para gestión y depreciación. Filtros: status, category.',
        requiredPermission: 'finance:read',
        mockTriggers: [
          'activo fijo',
          'activos fijos',
          'depreciaci',
          'capital',
          'fixed asset',
        ],
        input_schema: schema({
          status: { type: 'string', description: 'Estado del activo' },
          category: { type: 'string', description: 'Categoría' },
        }),
        run: (i) =>
          this.svc(FixedAssetsService)
            .list({ status: str(i.status), category: str(i.category) })
            .then((d) => clip(d, 60)),
      },
      // ── Trazabilidad: Genealogía as-built ──────────────────────────────────
      {
        name: 'genealogy_links',
        description:
          'Genealogía as-built: vínculos serial ↔ material ↔ lote capturados en producción. Úsalo para "¿qué componentes/lotes lleva este serial?" o "¿dónde se usó este lote?". Filtros: serial, part, lot.',
        requiredPermission: 'production:report',
        mockTriggers: [
          'genealog',
          'as-built',
          'as built',
          'qué lleva',
          'que lleva',
          'dónde se usó',
          'donde se uso',
          'número de serie',
          'numero de serie',
        ],
        input_schema: schema({
          serial: { type: 'string', description: 'Número de serie' },
          part: { type: 'string', description: 'Número de parte / componente' },
          lot: { type: 'string', description: 'Lote' },
        }),
        run: (i) =>
          this.svc(GenealogyService)
            .listLinks({
              serial: str(i.serial),
              part: str(i.part),
              lot: str(i.lot),
            })
            .then((d) => clip(d, 80)),
      },
      // ── Acción con confirmación humana (human-in-the-loop) ──────────────────
      {
        name: 'propose_action',
        description:
          'PROPONE (no ejecuta) una acción de escritura para que el USUARIO la confirme. ' +
          'Úsalo SOLO cuando el usuario pida explícitamente crear/realizar algo accionable. ' +
          'La acción NO se ejecuta hasta que el usuario confirme en la tarjeta; tras llamar a ' +
          'esta herramienta, dile al usuario que revise y confirme. Acciones disponibles: ' +
          'create_maintenance_order (params: title [req], description, type ' +
          '[PREVENTIVE|CORRECTIVE|PREDICTIVE], priority [LOW|MEDIUM|HIGH], assetId, assignedTo, ' +
          'dueDate); release_quality_hold (liberar retención de calidad; params: holdId [req, ' +
          'número]); create_purchase_requisition (params: partNumber [req], quantity [req, ' +
          'número], needBy, description, notes); create_production_plan (params: model [req], ' +
          'line [req, 1–7], quantity [req], shift [req, T1|T2|T3], workOrder, bahia [1–6], ' +
          'scheduledAt); assign_ehs_incident_owner (asignar responsable a incidente; params: ' +
          'incidentId [req], owner [req], dueDate); set_maintenance_order_status (cambiar estado ' +
          'de una orden de mantenimiento; params: orderId [req], status [req: OPEN|IN_PROGRESS|' +
          'COMPLETED|CANCELLED]); create_safety_incident (reportar incidente EHS; params: title ' +
          '[req], description, area, location).',
        requiredPermission: null,
        mockTriggers: [
          'crea una orden',
          'crear orden',
          'levanta una orden',
          'abre una orden',
          'genera una orden',
          'haz una orden',
        ],
        input_schema: schema(
          {
            actionKey: {
              type: 'string',
              enum: ACTION_KEYS,
              description: 'Clave de la acción a proponer.',
            },
            params: {
              type: 'object',
              description:
                'Parámetros de la acción, p. ej. {"title":"Cambiar termopar","priority":"HIGH"}.',
            },
          },
          ['actionKey'],
        ),
        run: (i, ctx) => {
          const actionKey = str(i.actionKey);
          const def = actionKey ? ACTIONS[actionKey] : undefined;
          if (!def) {
            return Promise.resolve({
              error: `Acción desconocida. Disponibles: ${ACTION_KEYS.join(', ')}.`,
            });
          }
          const allowed =
            ctx.isAdmin || ctx.permissions.includes(def.requiredPermission);
          if (!allowed) {
            return Promise.resolve({
              error: 'No tienes permiso para proponer esta acción.',
            });
          }
          const raw =
            i.params && typeof i.params === 'object' && !Array.isArray(i.params)
              ? (i.params as Record<string, unknown>)
              : {};
          const v = def.validate(raw);
          if (!v.ok || !v.params) {
            return Promise.resolve({
              error: v.error ?? 'Parámetros inválidos.',
            });
          }
          return Promise.resolve({
            proposal: {
              actionKey: def.key,
              label: def.label,
              params: v.params,
              summary: def.summarize(v.params),
              requiresPermission: def.requiredPermission,
            },
          });
        },
      },
    ];
  }
}
