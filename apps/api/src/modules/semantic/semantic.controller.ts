import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SemanticPrincipal, SemanticService } from './semantic.service';
import { UpsertMetricDto } from './dto/upsert-metric.dto';
import { UpsertObjectDto } from './dto/upsert-object.dto';

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

  /** Definitions: metric catalog + ontology (object types + links). Any user. */
  @Get('catalog')
  catalog(@Request() req: AuthReq) {
    return this.semantic.catalog(this.tenant(req));
  }

  /** Live values for every metric the caller may see. Any user (RBAC per metric). */
  @Get('values')
  values(@Request() req: AuthReq) {
    return this.semantic.values(this.principal(req), this.tenant(req));
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

  private assertAdmin(req: AuthReq) {
    if (req.user?.role !== 'Admin') {
      throw new ForbiddenException(
        'Solo un administrador puede editar el catálogo semántico.',
      );
    }
  }
}
