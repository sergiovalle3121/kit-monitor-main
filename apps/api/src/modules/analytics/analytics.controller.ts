import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

interface ReqUser {
  role: string;
  permissions?: string[] | null;
  tenant_id?: string | null;
}
interface AuthReq {
  user: ReqUser;
}

/** Coerce a query value to a positive int within [min, max], else undefined. */
function intIn(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Daily activity trend (time series + narrative). Aggregate, any user. */
  @Get('ledger-trend')
  ledgerTrend(
    @Query('days') days?: string,
    @Query('domain') domain?: string,
    @Query('line') line?: string,
  ) {
    return this.analytics.ledgerTrend({
      days: intIn(days, 1, 90),
      domain: str(domain),
      line: str(line),
    });
  }

  /** Activity broken down by domain over a window (+ narrative). Aggregate, any user. */
  @Get('domain-breakdown')
  domainBreakdown(@Query('sinceHours') sinceHours?: string) {
    return this.analytics.domainBreakdown({
      sinceHours: intIn(sinceHours, 1, 720),
    });
  }

  /** Object-centric drill-down for an ontology object (RBAC-gated metrics). */
  @Get('object/:key')
  objectInsight(@Request() req: AuthReq, @Param('key') key: string) {
    return this.analytics.objectInsight(
      {
        isAdmin: req.user?.role === 'Admin',
        permissions: req.user?.permissions ?? [],
      },
      key,
      req.user?.tenant_id ?? undefined,
    );
  }

  /** What-if projection of activity (optionally by domain), with a lever. */
  @Get('project')
  project(
    @Query('domain') domain?: string,
    @Query('days') days?: string,
    @Query('horizon') horizon?: string,
    @Query('adjustmentPct') adjustmentPct?: string,
  ) {
    return this.analytics.project({
      domain: str(domain),
      days: intIn(days, 7, 90),
      horizonDays: intIn(horizon, 1, 30),
      adjustmentPct: intIn(adjustmentPct, -100, 200),
    });
  }
}
