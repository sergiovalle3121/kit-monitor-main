import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { ReturnsService } from './returns.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly warehouseService: WarehouseService,
    private readonly returnsService: ReturnsService,
  ) {}

  @Get('locations')
  @RequirePermissions('materials:read')
  async getLocations(@Query() filters: any, @Request() req: any) {
    return this.warehouseService.getLocationVisibility(filters, req.user);
  }

  @Get('tasks')
  @RequirePermissions('materials:read')
  async getTasks(@Query() filters: any, @Request() req: any) {
    return this.warehouseService.findAllTasks(filters, req.user);
  }

  @Post('tasks')
  @RequirePermissions('materials:write')
  async createTask(@Body() dto: any, @Request() req: any) {
    return this.warehouseService.createTask(dto, req.user);
  }

  @Patch('tasks/:id/start')
  @RequirePermissions('materials:write')
  async startTask(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.warehouseService.startTask(id, actor, req.user);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions('materials:write')
  async completeTask(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.warehouseService.completeTask(id, actor, req.user);
  }

  // ─── PULL MONITOR (nativo) ──────────────────────────────────────────────────

  /** Cola de pulls decorada con aging/SLA y nombre de almacén (para el monitor). */
  @Get('pulls')
  @RequirePermissions('materials:read')
  async getPulls(@Query() filters: any, @Request() req: any) {
    return this.warehouseService.getPullMonitor(filters, req.user);
  }

  /** Crear un pull (pedido de material del piso al almacén). */
  @Post('pulls')
  @RequirePermissions('materials:write')
  async createPull(@Body() dto: any, @Request() req: any) {
    return this.warehouseService.createPull(dto, req.user);
  }

  /** Importa los llamados de resurtido (e-kanban) abiertos de material-staging como pulls. */
  @Post('pulls/import-replenish')
  @RequirePermissions('materials:write')
  async importReplenish(@Body() dto: any, @Request() req: any) {
    return this.warehouseService.importReplenishCalls(dto, req.user);
  }

  /** Importa una pull-list (filas de CSV) creando un pull por línea. */
  @Post('pulls/import')
  @RequirePermissions('materials:write')
  async importPullList(@Body() body: { rows: any[] }, @Request() req: any) {
    return this.warehouseService.importPullList(body?.rows ?? [], req.user);
  }

  /** Entregar un pull (cierra COMPLETED + deliveredAt; movimiento best-effort). */
  @Patch('tasks/:id/deliver')
  @RequirePermissions('materials:write')
  async deliverTask(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.warehouseService.deliverTask(id, actor, req.user);
  }

  /** Cancelar un pull. */
  @Patch('tasks/:id/cancel')
  @RequirePermissions('materials:write')
  async cancelTask(@Param('id') id: number, @Body() body: { actor: string; reason?: string }, @Request() req: any) {
    return this.warehouseService.cancelTask(id, body?.actor, body?.reason, req.user);
  }

  /** Asignar un pull a un responsable (supervisor reparte la carga). */
  @Patch('tasks/:id/assign')
  @RequirePermissions('materials:write')
  async assignTask(@Param('id') id: number, @Body('assignee') assignee: string, @Request() req: any) {
    return this.warehouseService.assignTask(id, assignee, req.user);
  }

  /** Analítica de suministro sobre el histórico de pulls. */
  @Get('analytics')
  @RequirePermissions('materials:read')
  async getAnalytics(@Query() filters: any, @Request() req: any) {
    return this.warehouseService.getSupplyAnalytics(filters, req.user);
  }

  // ─── DEVOLUCIONES DE MATERIAL ───────────────────────────────────────────────

  @Get('returns')
  @RequirePermissions('materials:read')
  async getReturns(@Query() filters: any, @Request() req: any) {
    return this.returnsService.findAll(filters, req.user);
  }

  @Get('returns/:id')
  @RequirePermissions('materials:read')
  async getReturn(@Param('id') id: number, @Request() req: any) {
    return this.returnsService.findOne(id, req.user);
  }

  @Post('returns')
  @RequirePermissions('materials:write')
  async createReturn(@Body() dto: any, @Request() req: any) {
    return this.returnsService.create(dto, req.user);
  }

  @Patch('returns/:id/complete')
  @RequirePermissions('materials:write')
  async completeReturn(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.returnsService.complete(id, actor, req.user);
  }

  @Patch('returns/:id/cancel')
  @RequirePermissions('materials:write')
  async cancelReturn(@Param('id') id: number, @Body() body: { actor: string; reason?: string }, @Request() req: any) {
    return this.returnsService.cancel(id, body?.actor, body?.reason, req.user);
  }

  // Picking
  @Get('picking/backlog')
  @RequirePermissions('materials:read')
  async getPickingBacklog(@Query('warehouseId') warehouseId: string, @Request() req: any) {
    return this.warehouseService.getPickingBacklog(warehouseId, req.user);
  }

  @Post('picking/:id/exception')
  @RequirePermissions('materials:write')
  async handleException(@Param('id') id: number, @Body() exception: any, @Request() req: any) {
    return this.warehouseService.handlePickException(id, exception, req.user);
  }
}
