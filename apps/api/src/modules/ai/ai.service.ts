import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AiTenantConfig } from './entities/ai-tenant-config.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiToolsService, ToolContext } from './ai-tools.service';
import { ChatDto } from './dto/chat.dto';
import { ConfigDto } from './dto/config.dto';
import { decryptSecret, encryptSecret, last4 } from './ai-crypto';
import {
  ALLOWED_MODELS,
  TokenUsage,
  billableTokens,
  emptyUsage,
  estimateCostUsd,
} from './ai-pricing';

/** The slice of req.user (hydrated by JwtStrategy) this service relies on. */
export interface ReqUser {
  userId: string;
  email: string;
  role: string;
  permissions?: string[] | null;
  tenant_id?: string | null;
}

const DEFAULT_TENANT = '__default__';
const MAX_TOOL_ROUNDS = 5;
const MAX_TOOL_RESULT_CHARS = 12_000;

interface RunResult {
  text: string;
  usage: TokenUsage;
  toolsUsed: string[];
}

function summarize(out: unknown): string {
  if (
    out &&
    typeof out === 'object' &&
    'error' in (out as Record<string, unknown>)
  ) {
    return String((out as Record<string, unknown>).error);
  }
  if (Array.isArray(out)) return `${out.length} registro(s)`;
  const s = JSON.stringify(out ?? null);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiTenantConfig)
    private readonly configRepo: Repository<AiTenantConfig>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
    @InjectRepository(AiConversation)
    private readonly convRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly msgRepo: Repository<AiMessage>,
    private readonly tools: AiToolsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────
  private async getOrCreateConfig(tenantId: string): Promise<AiTenantConfig> {
    let cfg = await this.configRepo.findOne({ where: { tenantId } });
    if (!cfg) {
      cfg = await this.configRepo.save(
        this.configRepo.create({
          tenantId,
          enabled: true,
          monthlyTokenBudget: Number(
            process.env.AI_DEFAULT_MONTHLY_BUDGET_TOKENS ?? 1_000_000,
          ),
        }),
      );
    }
    return cfg;
  }

  private ensurePeriod(cfg: AiTenantConfig): void {
    const now = new Date();
    const start = cfg.periodStart ? new Date(cfg.periodStart) : null;
    if (
      !start ||
      start.getUTCFullYear() !== now.getUTCFullYear() ||
      start.getUTCMonth() !== now.getUTCMonth()
    ) {
      cfg.periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      cfg.tokensUsedThisPeriod = 0;
    }
  }

  async getConfigPublic(reqUser: ReqUser) {
    const cfg = await this.getOrCreateConfig(
      reqUser.tenant_id ?? DEFAULT_TENANT,
    );
    return this.publicConfig(cfg);
  }

  async setConfig(reqUser: ReqUser, dto: ConfigDto) {
    const cfg = await this.getOrCreateConfig(
      reqUser.tenant_id ?? DEFAULT_TENANT,
    );
    if (dto.enabled !== undefined) cfg.enabled = dto.enabled;
    if (dto.defaultModel) cfg.defaultModel = dto.defaultModel;
    if (dto.escalationModel) cfg.escalationModel = dto.escalationModel;
    if (dto.monthlyTokenBudget !== undefined)
      cfg.monthlyTokenBudget = dto.monthlyTokenBudget;
    if (dto.rateLimitPerHour !== undefined)
      cfg.rateLimitPerHour = dto.rateLimitPerHour;
    if (dto.apiKey !== undefined) {
      const k = dto.apiKey.trim();
      if (!k) {
        cfg.byoApiKeyCipher = null;
        cfg.byoKeyLast4 = null;
      } else {
        cfg.byoApiKeyCipher = encryptSecret(k);
        cfg.byoKeyLast4 = last4(k);
      }
    }
    await this.configRepo.save(cfg);
    return this.publicConfig(cfg);
  }

  private publicConfig(cfg: AiTenantConfig) {
    return {
      tenantId: cfg.tenantId,
      enabled: cfg.enabled,
      defaultModel: cfg.defaultModel,
      escalationModel: cfg.escalationModel,
      monthlyTokenBudget: Number(cfg.monthlyTokenBudget),
      tokensUsedThisPeriod: Number(cfg.tokensUsedThisPeriod),
      rateLimitPerHour: cfg.rateLimitPerHour,
      periodStart: cfg.periodStart,
      byoKey: cfg.byoApiKeyCipher
        ? { configured: true, last4: cfg.byoKeyLast4 }
        : { configured: false, last4: null },
      platformKeyAvailable: !!process.env.ANTHROPIC_API_KEY,
      mock: process.env.AI_MOCK === '1',
      availableModels: ALLOWED_MODELS,
    };
  }

  // ── Usage ──────────────────────────────────────────────────────────────────
  async usageSummary(reqUser: ReqUser) {
    const tenantId = reqUser.tenant_id ?? DEFAULT_TENANT;
    const rows = await this.usageRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    const totals = rows.reduce(
      (acc, r) => {
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.cacheReadTokens += r.cacheReadTokens;
        acc.cacheWriteTokens += r.cacheWriteTokens;
        acc.costUsd += Number(r.costUsd);
        acc.turns += 1;
        return acc;
      },
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: 0,
        turns: 0,
      },
    );
    const byModel: Record<
      string,
      { turns: number; tokens: number; costUsd: number }
    > = {};
    for (const r of rows) {
      const m = (byModel[r.model] ??= { turns: 0, tokens: 0, costUsd: 0 });
      m.turns += 1;
      m.tokens +=
        r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens;
      m.costUsd += Number(r.costUsd);
    }
    return { tenantId, totals, byModel, recent: rows.slice(0, 25) };
  }

  // ── Conversations ───────────────────────────────────────────────────────────
  async listConversations(reqUser: ReqUser) {
    const tenantId = reqUser.tenant_id ?? DEFAULT_TENANT;
    return this.convRepo.find({
      where: { tenantId, userEmail: reqUser.email },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async getConversation(reqUser: ReqUser, id: string) {
    const conversation = await this.convRepo.findOne({ where: { id } });
    if (!conversation)
      throw new NotFoundException('Conversación no encontrada');
    if (conversation.userEmail !== reqUser.email && reqUser.role !== 'Admin') {
      throw new ForbiddenException('No puedes ver esta conversación.');
    }
    const messages = await this.msgRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
    });
    return { conversation, messages };
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────
  async chat(reqUser: ReqUser, dto: ChatDto) {
    const tenantId = reqUser.tenant_id ?? DEFAULT_TENANT;
    const cfg = await this.getOrCreateConfig(tenantId);
    if (!cfg.enabled) {
      throw new ForbiddenException(
        'El asistente de IA está deshabilitado para tu organización.',
      );
    }

    // Resolve provider key + billing mode.
    const byo = !!cfg.byoApiKeyCipher;
    const apiKey = byo
      ? decryptSecret(cfg.byoApiKeyCipher as string)
      : (process.env.ANTHROPIC_API_KEY ?? null);
    const mock = process.env.AI_MOCK === '1' || apiKey === 'mock';
    if (!mock && !apiKey) {
      throw new BadRequestException(
        'La IA aún no está configurada. Un administrador debe agregar una API key de Anthropic (de la plataforma o propia) en Configuración → IA.',
      );
    }

    // Budget cap applies to platform-key usage; BYO tenants are unmetered.
    if (!byo) {
      this.ensurePeriod(cfg);
      if (Number(cfg.tokensUsedThisPeriod) >= Number(cfg.monthlyTokenBudget)) {
        await this.configRepo.save(cfg);
        throw new HttpException(
          `Se alcanzó el presupuesto mensual de IA de tu organización (${Number(
            cfg.monthlyTokenBudget,
          ).toLocaleString()} tokens). Un administrador puede ampliarlo o configurar una API key propia (BYO).`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Per-user hourly rate limit.
    const since = new Date(Date.now() - 3_600_000);
    const recentCount = await this.usageRepo.count({
      where: { userEmail: reqUser.email, createdAt: MoreThan(since) },
    });
    if (recentCount >= cfg.rateLimitPerHour) {
      throw new HttpException(
        `Alcanzaste el límite de ${cfg.rateLimitPerHour} consultas por hora. Intenta de nuevo más tarde.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Load the full user entity so scope-aware service calls filter correctly.
    let userEntity: User;
    try {
      userEntity = await this.moduleRef
        .get(UsersService, { strict: false })
        .findOne(reqUser.userId);
    } catch {
      userEntity = {
        id: reqUser.userId,
        email: reqUser.email,
        role: reqUser.role,
        permissions: reqUser.permissions ?? [],
        scopes: {},
      } as unknown as User;
    }
    const ctx: ToolContext = {
      user: userEntity,
      isAdmin: reqUser.role === 'Admin',
      permissions: reqUser.permissions ?? [],
    };

    // Resolve / create the conversation thread.
    let conv: AiConversation | null = null;
    if (dto.conversationId) {
      conv = await this.convRepo.findOne({ where: { id: dto.conversationId } });
      if (
        conv &&
        conv.userEmail !== reqUser.email &&
        reqUser.role !== 'Admin'
      ) {
        conv = null;
      }
    }
    if (!conv) {
      conv = await this.convRepo.save(
        this.convRepo.create({
          tenantId,
          userEmail: reqUser.email,
          title: dto.message.slice(0, 60) || 'Nueva conversación',
        }),
      );
    }
    const priorAll = await this.msgRepo.find({
      where: { conversationId: conv.id },
      order: { createdAt: 'ASC' },
    });
    const history = priorAll.slice(-20);

    const model =
      dto.model && ALLOWED_MODELS.includes(dto.model)
        ? dto.model
        : cfg.defaultModel;
    const system = this.buildSystem(reqUser);
    const specs = this.tools.toolSpecs(ctx);

    // Run the model (real Anthropic call, or deterministic demo without a key).
    const result = mock
      ? await this.runMock(dto.message, ctx)
      : await this.runReal(
          apiKey as string,
          model,
          system,
          history,
          dto.message,
          specs,
          ctx,
        );

    const uniqueTools = [...new Set(result.toolsUsed)];

    // Persist the turn.
    await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conv.id,
        role: 'user',
        content: dto.message,
      }),
    );
    await this.msgRepo.save(
      this.msgRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: result.text,
        toolsUsed: uniqueTools.length ? uniqueTools : null,
      }),
    );
    await this.convRepo.update(conv.id, { updatedAt: new Date() });

    // Meter usage + advance the budget counter.
    const cost = estimateCostUsd(model, result.usage);
    await this.usageRepo.save(
      this.usageRepo.create({
        tenantId,
        userEmail: reqUser.email,
        conversationId: conv.id,
        model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        costUsd: cost,
        usedByoKey: byo,
        mock,
        toolCalls: result.toolsUsed.length,
      }),
    );
    if (!byo) {
      cfg.tokensUsedThisPeriod =
        Number(cfg.tokensUsedThisPeriod) + billableTokens(result.usage);
      await this.configRepo.save(cfg);
    }

    return {
      conversationId: conv.id,
      reply: result.text,
      model,
      mock,
      usedByoKey: byo,
      toolsUsed: uniqueTools,
      usage: result.usage,
      costUsd: cost,
    };
  }

  private buildSystem(reqUser: ReqUser): string {
    const today = new Date().toISOString().slice(0, 10);
    return [
      'Eres Axos Copilot, el asistente de IA integrado en Axos OS, un sistema industrial MES/ERP.',
      `Fecha de hoy: ${today}.`,
      `Usuario: ${reqUser.email} (rol: ${reqUser.role}).`,
      'Respondes SIEMPRE en el idioma del usuario (español por defecto), de forma breve, concreta y profesional.',
      'Basas tus respuestas ÚNICAMENTE en los datos que devuelven las herramientas. Nunca inventes cifras ni nombres.',
      'Si una herramienta no devuelve datos, dilo claramente en vez de suponer.',
      'Solo tienes acceso a las herramientas permitidas para el rol del usuario; si te piden algo fuera de tu alcance, explícalo con cortesía.',
      'Al mostrar cifras financieras o de inventario, incluye unidades y, si aplica, el periodo.',
    ].join('\n');
  }

  private async runReal(
    apiKey: string,
    model: string,
    system: string,
    history: AiMessage[],
    userMessage: string,
    specs: Anthropic.Tool[],
    ctx: ToolContext,
  ): Promise<RunResult> {
    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];
    const usage = emptyUsage();
    const toolsUsed: string[] = [];
    let finalText = '';

    for (let round = 0; ; round++) {
      const offerTools = round < MAX_TOOL_ROUNDS && specs.length > 0;
      const resp = await client.messages.create({
        model,
        max_tokens: 1536,
        system,
        messages,
        ...(offerTools ? { tools: specs } : {}),
      });

      usage.inputTokens += resp.usage.input_tokens ?? 0;
      usage.outputTokens += resp.usage.output_tokens ?? 0;
      usage.cacheReadTokens += resp.usage.cache_read_input_tokens ?? 0;
      usage.cacheWriteTokens += resp.usage.cache_creation_input_tokens ?? 0;

      messages.push({ role: 'assistant', content: resp.content });

      if (resp.stop_reason === 'tool_use') {
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type === 'tool_use') {
            toolsUsed.push(block.name);
            const out = await this.tools.execute(
              block.name,
              (block.input ?? {}) as Record<string, unknown>,
              ctx,
            );
            results.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(out).slice(0, MAX_TOOL_RESULT_CHARS),
            });
          }
        }
        messages.push({ role: 'user', content: results });
        continue;
      }

      finalText = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    return {
      text: finalText || 'No pude generar una respuesta.',
      usage,
      toolsUsed,
    };
  }

  /**
   * Deterministic demo provider used when no API key is configured (or AI_MOCK=1).
   * It still executes the real grounding tools (so RBAC + data wiring are
   * exercised) but returns a clearly-labelled canned summary instead of a
   * generated answer — lets the UI be tried before any key/cost is committed.
   */
  private async runMock(message: string, ctx: ToolContext): Promise<RunResult> {
    const picks = this.tools.pickMockTools(message, ctx);
    const toolsUsed: string[] = [];
    const lines: string[] = [];
    for (const def of picks) {
      toolsUsed.push(def.name);
      const out = await this.tools.execute(def.name, {}, ctx);
      lines.push(`• ${def.name}: ${summarize(out)}`);
    }
    const text =
      '🔹 Modo demostración (sin API key configurada).\n\n' +
      `Consulté tus datos reales con: ${toolsUsed.join(', ') || 'ninguna herramienta disponible para tu rol'}.\n` +
      (lines.length ? `${lines.join('\n')}\n\n` : '\n') +
      'Cuando un administrador configure una API key de Anthropic (de la plataforma o propia) en Configuración → IA, responderé en lenguaje natural sobre estos datos.';
    return {
      text,
      usage: {
        inputTokens: 800,
        outputTokens: 180,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      toolsUsed,
    };
  }
}
