import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LiveService } from './live.service';
import { sanitizeChannels } from './live-channel';

/**
 * Live floor spine (read-only). GET /live/snapshot seeds the "Piso en Vivo"
 * board with the most recent floor events before the WebSocket stream takes
 * over. Same floor-read gate as the Line Control Tower (`production:read`).
 */
@ApiTags('Live')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('live')
export class LiveController {
  constructor(private readonly service: LiveService) {}

  @Get('snapshot')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary:
      'Estado inicial del piso en vivo: eventos recientes del ledger por canal + conteos.',
  })
  snapshot(
    @Query('channels') channels?: string,
    @Query('limit') limit?: string,
  ) {
    const list = channels
      ? sanitizeChannels(channels.split(',').map((c) => c.trim()))
      : undefined;
    return this.service.getSnapshot({
      channels: list && list.length ? list : undefined,
      limit: numOrUndef(limit),
    });
  }
}

function numOrUndef(v?: string): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
