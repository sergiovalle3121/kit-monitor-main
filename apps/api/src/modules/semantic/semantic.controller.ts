import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SemanticPrincipal, SemanticService } from './semantic.service';
import { UpsertMetricDto } from './dto/upsert-metric.dto';
import { UpsertObjectDto } from './dto/upsert-object.dto';
import { UpsertLinkDto } from './dto/upsert-link.dto';
import { ArchiveItemDto } from './dto/archive-item.dto';

interface ReqUser {
  userId: string;
  email: string;
  role: string;
  permissions?: string[] | null;
  tenant_id?: string | null;
}
interface AuthReq {
  user: ReqUser;
}

const DEFAULT_TENANT = '__default__';

@UseGuards(JwtAuthGuard)
@Controller('semantic')
export class SemanticController {
  constructor(private readonly semantic: SemanticService) {}

  private tenant(req: AuthReq): string {
    return req.user?.tenant_id ?? DEFAULT_TENANT;
  }

  private principal(req: AuthReq): SemanticPrincipal {
    return {
      isAdmin: req.user?.role === 'Admin',
      permissions: req.user?.permissions ?? [],
    };
  }

  /** Definitions: metric catalog + ontology (object types + links). Any user.
   *  `includeInactive=true` (admin only) also returns archived rows. */
  @Get('catalog')
  catalog(
    @Request() req: AuthReq,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const inactive =
      includeInactive === 'true' && req.user?.role === 'Admin';
    return this.semantic.catalog(this.tenant(req), inactive);
  }

  /** Live values for every metric the caller may see. Any user (RBAC per metric). */
  @Get('values')
  values(@Request() req: AuthReq) {
    return this.semantic.values(this.principal(req), this.tenant(req));
  }

  /** KPI value history (snapshots) per metric the caller may see. */
  @Get('history')
  history(@Request() req: AuthReq, @Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 30;
    return this.semantic.metricHistoryBatch(
      this.principal(req),
      this.tenant(req),
      Number.isFinite(d) ? d : 30,
    );
  }

  /** Proactive KPI alerts (target breach or adverse trend) for the caller. */
  @Get('alerts')
  alerts(@Request() req: AuthReq) {
    return this.semantic.evaluateAlerts(this.principal(req), this.tenant(req));
  }

  /** Push current critical KPI alerts to admins now (in-app + web-push). Admin. */
  @Post('alerts/notify')
  async notifyAlerts(@Request() req: AuthReq) {
    this.assertAdmin(req);
    const sent = await this.semantic.notifyAlerts(this.tenant(req));
    return { sent };
  }

  /** Live value for one metric. */
  @Get('metrics/:key/value')
  metricValue(@Request() req: AuthReq, @Param('key') key: string) {
    return this.semantic.resolveMetric(this.principal(req), key, this.tenant(req));
  }

  /** Create/update a metric definition. Admin only. */
  @Post('metrics')
  upsertMetric(@Request() req: AuthReq, @Body() dto: UpsertMetricDto) {
    this.assertAdmin(req);
    return this.semantic.upsertMetric(this.tenant(req), dto);
  }

  /** Create/update an ontology object type. Admin only. */
  @Post('objects')
  upsertObject(@Request() req: AuthReq, @Body() dto: UpsertObjectDto) {
    this.assertAdmin(req);
    return this.semantic.upsertObject(this.tenant(req), dto);
  }

  /** Create/update an ontology link type. Admin only. */
  @Post('links')
  upsertLink(@Request() req: AuthReq, @Body() dto: UpsertLinkDto) {
    this.assertAdmin(req);
    return this.semantic.upsertLink(this.tenant(req), dto);
  }

  /** Archive (active=false) or restore (active=true) a catalog item. Admin only. */
  @Post('archive')
  archive(@Request() req: AuthReq, @Body() dto: ArchiveItemDto) {
    this.assertAdmin(req);
    return this.semantic.setActive(
      this.tenant(req),
      dto.kind,
      dto.key,
      dto.active,
    );
  }

  private assertAdmin(req: AuthReq) {
    if (req.user?.role !== 'Admin') {
      throw new ForbiddenException(
        'Solo un administrador puede editar el catálogo semántico.',
      );
    }
  }
}
