import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('tasks')
  async getTasks(@Query() filters: any) {
    return this.warehouseService.findAllTasks(filters);
  }

  @Post('tasks')
  async createTask(@Body() dto: any) {
    return this.warehouseService.createTask(dto);
  }

  @Patch('tasks/:id/start')
  async startTask(@Param('id') id: number, @Body('actor') actor: string) {
    return this.warehouseService.startTask(id, actor);
  }

  @Patch('tasks/:id/complete')
  async completeTask(@Param('id') id: number, @Body('actor') actor: string) {
    return this.warehouseService.completeTask(id, actor);
  }
}
