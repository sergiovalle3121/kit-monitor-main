import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { WarehouseService } from './warehouse.service';

@ApiTags('warehouse')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('tasks')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'List warehouse tasks for the current tenant' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  getTasks(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.warehouseService.findAllTasks({ status, type, warehouseId });
  }

  @Post('tasks')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Create a warehouse task' })
  createTask(@Body() dto: any) {
    return this.warehouseService.createTask(dto);
  }

  @Patch('tasks/:id/start')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Start a warehouse task' })
  startTask(
    @Param('id', ParseIntPipe) id: number,
    @Body('actor') actor: string,
  ) {
    return this.warehouseService.startTask(id, actor);
  }

  @Patch('tasks/:id/complete')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Complete a warehouse task and execute the physical movement' })
  completeTask(
    @Param('id', ParseIntPipe) id: number,
    @Body('actor') actor: string,
  ) {
    return this.warehouseService.completeTask(id, actor);
  }

  @Get('picking/backlog')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Get open picking tasks scoped to current tenant' })
  @ApiQuery({ name: 'warehouseId', required: false })
  getPickingBacklog(@Query('warehouseId') warehouseId: string) {
    return this.warehouseService.getPickingBacklog(warehouseId);
  }

  @Post('picking/:id/exception')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Handle a pick exception (short pick, etc.)' })
  handleException(
    @Param('id', ParseIntPipe) id: number,
    @Body() exception: { reason: string; pickedQty: number; actor: string },
  ) {
    return this.warehouseService.handlePickException(id, exception);
  }
}
