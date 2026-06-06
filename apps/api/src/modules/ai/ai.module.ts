import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiTenantConfig } from './entities/ai-tenant-config.entity';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';

/**
 * Axos AI Copilot. Provider-agnostic AI layer (today: Anthropic Claude) grounded
 * over the real MES + ERP services via RBAC-filtered tools, with per-tenant keys,
 * monthly budgets, rate limits and usage metering. Cross-module services are
 * resolved lazily via ModuleRef, so no domain module needs to export them.
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
  providers: [AiService, AiToolsService],
})
export class AiModule {}
