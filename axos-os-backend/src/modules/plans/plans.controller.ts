import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, Query, UseGuards, Request } from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
    @Request() req: any
  ) {
    return this.plansService.findAll({ line, model, workOrder, buildingId, programId }, req.user);
  }

  @Get('intelligence')
  @RequirePermissions('PLANNING_VIEW')
  getIntelligence() {
    return this.plansService.getSchedulingIntelligence();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Post()
  @RequirePermissions('MANAGE_PLANS')
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Post(':id/release')
  @RequirePermissions('RELEASE_WO')
  release(@Param('id', ParseIntPipe) id: number, @Body('actor') actor: string) {
    return this.plansService.releaseWorkOrder(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('MANAGE_PLANS')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('MANAGE_PLANS')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}
