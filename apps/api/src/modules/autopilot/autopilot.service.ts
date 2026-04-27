import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CorrectiveProposal } from './entities/corrective-proposal.entity';
import { ProductionWip } from '../production-runtime/entities/production-wip.entity';
import { Resupply } from '../resupplies/entities/resupply.entity';
import { BottleneckService } from '../production-runtime/bottleneck.service';
import { DecisionIntelligenceService } from '../decision-intelligence/decision-intelligence.service';
import { SignalGateway } from '../../common/gateway/signal.gateway';
import { TenantContextService } from '../../common/services/tenant-context.service';
import { ProposalExecutionResult } from './dto/autopilot.dto';

const BOTTLENECK_THRESHOLD = 0.7;   // SeverityScore above which we generate a proposal
const SIGMA_THRESHOLD      = 2.0;   // SigmaLevel below which we flag instability
const PROPOSAL_TTL_HOURS   = 4;     // Auto-expire proposals older than this

@Injectable()
export class AutopilotService {
  private readonly logger = new Logger(AutopilotService.name);

  constructor(
    @InjectRepository(CorrectiveProposal)
    private readonly proposalRepo: Repository<CorrectiveProposal>,
    @InjectRepository(ProductionWip)
    private readonly wipRepo: Repository<ProductionWip>,
    @InjectRepository(Resupply)
    private readonly resupplyRepo: Repository<Resupply>,
    private readonly bottleneck: BottleneckService,
    private readonly diService: DecisionIntelligenceService,
    private readonly signals: SignalGateway,
    private readonly tenantCtx: TenantContextService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runAutopilotScan(): Promise<void> {
    this.logger.log('Autopilot scan started');
    try {
      await this.expireStaleProposals();
      await this.scanBottlenecks();
      await this.scanSigmaStability();
    } catch (err: any) {
      this.logger.error(`Autopilot scan error: ${err?.message}`, err?.stack);
    }
    this.logger.log('Autopilot scan completed');
  }

  async listProposals(
    status?: string,
    tenantId?: string,
  ): Promise<CorrectiveProposal[]> {
    const where: any = {};
    if (status)   where.status   = status;
    if (tenantId) where.tenantId = tenantId;
    return this.proposalRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async executeProposal(
    id: number,
    actor?: string,
  ): Promise<ProposalExecutionResult> {
    const proposal = await this.proposalRepo.findOne({ where: { id } });
    if (!proposal) throw new NotFoundException(`Proposal #${id} not found`);
    if (proposal.status !== 'pending') {
      throw new NotFoundException(
        `Proposal #${id} is already ${proposal.status}`,
      );
    }

    let details: Record<string, any> = {};

    switch (proposal.executionType) {
      case 'wip_rebalance':
        details = await this.executeWipRebalance(proposal);
        break;
      case 'resupply_trigger':
        details = await this.executeResupplyTrigger(proposal);
        break;
      case 'maintenance_audit':
        details = await this.executeMaintenanceAudit(proposal);
        break;
      default:
        details = { note: 'No automated execution available for this type. Manual review required.' };
    }

    await this.proposalRepo.update(id, {
      status:     'executed',
      executedAt: new Date(),
      executedBy: actor ?? 'system',
    });

    return {
      proposalId: id,
      action:     proposal.executionType ?? 'acknowledged',
      executedAt: new Date().toISOString(),
      details,
    };
  }

  private async scanBottlenecks(): Promise<void> {
    const activeWips = await this.wipRepo.find({
      where: { status: 'in_production' },
      take: 20,
    });

    const models = [...new Set(activeWips.map((w) => w.partNumber))];

    for (const model of models) {
      try {
        const report = await this.bottleneck.analyzeBottlenecks({
          model,
          windowMinutes: 60,
        });

        for (const hotspot of report.hotspots) {
          if (hotspot.severityScore <= BOTTLENECK_THRESHOLD) continue;

          const alreadyExists = await this.proposalRepo.findOne({
            where: {
              category:  'bottleneck',
              model,
              bayId:     hotspot.bayId,
              status:    'pending',
            },
          });
          if (alreadyExists) continue;

          const wip = activeWips.find((w) => w.partNumber === model);
          const severity = hotspot.severityScore > 0.9 ? 'critical'
                         : hotspot.severityScore > 0.8 ? 'high'
                         : 'medium';

          const proposal = await this.proposalRepo.save(
            this.proposalRepo.create({
              category:     'bottleneck',
              title:        `Bottleneck detected — Bay ${hotspot.bayId} (${model})`,
              description:  hotspot.recommendation,
              severity,
              tenantId:     wip?.building ?? 'default',
              line:         wip?.line     ?? null,
              model,
              bayId:        hotspot.bayId,
              severityScore: hotspot.severityScore,
              executionType: 'wip_rebalance',
              executionPayload: {
                model,
                bayId:        hotspot.bayId,
                type:         hotspot.type,
                efficiencyGap: hotspot.efficiencyGap,
                wipIds:       activeWips
                  .filter((w) => w.partNumber === model)
                  .map((w) => w.id),
              },
            }),
          );

          this.signals.emitProposal(proposal.tenantId ?? 'default', proposal);
          this.logger.log(
            `Proposal #${proposal.id} created: bottleneck Bay ${hotspot.bayId} model ${model} (score ${hotspot.severityScore})`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Bottleneck scan failed for model ${model}: ${err?.message}`,
        );
      }
    }
  }

  private async scanSigmaStability(): Promise<void> {
    const activeWips = await this.wipRepo.find({
      where: { status: 'in_production' },
      take: 20,
    });

    const lines = [...new Set(activeWips.map((w) => w.line).filter(Boolean))];

    for (const line of lines) {
      if (!line) continue;
      try {
        const report = await this.diService.getStabilityReport(
          line,
          undefined,
          8,
        );

        if (report.overallSigmaLevel >= SIGMA_THRESHOLD) continue;
        if (!report.bays.length) continue;

        const alreadyExists = await this.proposalRepo.findOne({
          where: { category: 'sigma_instability', line, status: 'pending' },
        });
        if (alreadyExists) continue;

        const wip = activeWips.find((w) => w.line === line);
        const severity = report.overallSigmaLevel < 1.0 ? 'critical'
                       : report.overallSigmaLevel < 1.5 ? 'high'
                       : 'medium';

        const worstBay = report.bays.reduce(
          (a, b) => (a.sigmaLevel < b.sigmaLevel ? a : b),
        );

        const proposal = await this.proposalRepo.save(
          this.proposalRepo.create({
            category:   'sigma_instability',
            title:      `Sigma instability — Line ${line} (σ = ${report.overallSigmaLevel.toFixed(2)})`,
            description:
              `Process stability is below the 2σ threshold on Line ${line}. ` +
              `Worst bay: Bay ${worstBay.bayId} at σ = ${worstBay.sigmaLevel.toFixed(2)}. ` +
              `Triggering urgent Maintenance Audit.`,
            severity,
            tenantId:     wip?.building ?? 'default',
            line,
            model:        wip?.partNumber ?? null,
            sigmaLevel:   report.overallSigmaLevel,
            executionType: 'maintenance_audit',
            executionPayload: {
              line,
              overallSigmaLevel: report.overallSigmaLevel,
              worstBayId:        worstBay.bayId,
              worstBaySigma:     worstBay.sigmaLevel,
              outOfControlCount: report.bays.reduce((s, b) => s + b.outOfControlCount, 0),
            },
          }),
        );

        this.signals.emitProposal(proposal.tenantId ?? 'default', proposal);
        this.logger.log(
          `Proposal #${proposal.id} created: sigma_instability line ${line} (σ = ${report.overallSigmaLevel})`,
        );
      } catch (err: any) {
        this.logger.warn(
          `Stability scan failed for line ${line}: ${err?.message}`,
        );
      }
    }
  }

  private async executeWipRebalance(
    proposal: CorrectiveProposal,
  ): Promise<Record<string, any>> {
    const payload = proposal.executionPayload ?? {};
    const wipIds: number[] = payload['wipIds'] ?? [];

    if (!wipIds.length) {
      return { note: 'No WIP IDs in payload — nothing to rebalance.' };
    }

    // Find the bottlenecked WIP and put a lower-priority one on_hold to free up capacity
    const wips = await this.wipRepo.find({
      where: { id: In(wipIds), status: 'in_production' },
      order: { targetQty: 'ASC' },
    });

    if (wips.length < 2) {
      return { note: 'Only one active WIP on this line — no rebalance possible.' };
    }

    // Put the smallest-target WIP on hold to free up resources for the bottleneck
    const candidate = wips[0];
    await this.wipRepo.update(candidate.id, { status: 'on_hold' });

    return {
      action:     'wip_put_on_hold',
      wipId:      candidate.id,
      workOrder:  candidate.workOrder,
      partNumber: candidate.partNumber,
      targetQty:  candidate.targetQty,
      reason:     `Paused to resolve bottleneck at Bay ${proposal.bayId} (severity ${proposal.severityScore})`,
    };
  }

  private async executeResupplyTrigger(
    proposal: CorrectiveProposal,
  ): Promise<Record<string, any>> {
    const payload = proposal.executionPayload ?? {};

    const resupply = await this.resupplyRepo.save(
      this.resupplyRepo.create({
        partNumber:        payload['partNumber'] ?? 'UNKNOWN',
        quantityRequested: payload['quantity']   ?? 10,
        priority:          'critical',
        reason:            `Autopilot trigger: ${proposal.title}`,
        status:            'requested',
      }),
    );

    return {
      action:    'resupply_created',
      resupplyId: resupply.id,
      partNumber: resupply.partNumber,
      quantity:   resupply.quantityRequested,
    };
  }

  private async executeMaintenanceAudit(
    proposal: CorrectiveProposal,
  ): Promise<Record<string, any>> {
    const payload = proposal.executionPayload ?? {};

    this.signals.emitCriticalEvent(proposal.tenantId ?? 'default', {
      domain:     'PRODUCTION',
      action:     'MAINTENANCE_AUDIT_TRIGGERED',
      referenceId: proposal.id.toString(),
      line:       proposal.line ?? undefined,
      model:      proposal.model ?? undefined,
      metadata:   {
        sigmaLevel:        payload['overallSigmaLevel'],
        worstBayId:        payload['worstBayId'],
        outOfControlCount: payload['outOfControlCount'],
      },
    });

    return {
      action:         'maintenance_audit_triggered',
      line:           proposal.line,
      sigmaLevel:     payload['overallSigmaLevel'],
      worstBayId:     payload['worstBayId'],
      recommendation: 'Schedule immediate maintenance review for the identified bay.',
    };
  }

  private async expireStaleProposals(): Promise<void> {
    const cutoff = new Date(Date.now() - PROPOSAL_TTL_HOURS * 3_600_000);
    const result = await this.proposalRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'expired' })
      .where('status = :s', { s: 'pending' })
      .andWhere('createdAt < :cutoff', { cutoff })
      .execute();

    if (result.affected) {
      this.logger.debug(`Expired ${result.affected} stale proposal(s)`);
    }
  }
}
