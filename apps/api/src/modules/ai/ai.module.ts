import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiTenantConfig } from './entities/ai-tenant-config.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiActionsService } from './ai-actions.service';
import { AiInsightsService } from './ai-insights.service';
import { AiBriefingTask } from './ai-briefing.task';

/**
 * CIDE — Axos OS's own AI. A self-hosted, OpenAI-compatible AI layer (no external
 * vendor) grounded over the real MES + ERP services via RBAC-filtered tools, with
 * per-tenant config, monthly usage guardrails, rate limits and usage metering.
 * Cross-module services are resolved lazily via ModuleRef, so no domain module
 * needs to export them.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiTenantConfig,
      AiUsageLog,
      AiConversation,
      AiMessage,
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    AiActionsService,
    AiInsightsService,
    AiBriefingTask,
  ],
})
export class AiModule {}
