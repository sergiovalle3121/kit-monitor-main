import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'List production plans for the current tenant' })
  @ApiQuery({ name: 'line', required: false })
  @ApiQuery({ name: 'model', required: false })
  @ApiQuery({ name: 'workOrder', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  findAll(
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.plansService.findAll({ line, model, workOrder, buildingId, programId });
  }

  @Get('intelligence')
  @RequirePermissions('PLANNING_VIEW')
  @ApiOperation({ summary: 'Get scheduling intelligence and line load' })
  getIntelligence() {
    return this.plansService.getSchedulingIntelligence();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single plan by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @Post()
  @RequirePermissions('MANAGE_PLANS')
  @ApiOperation({ summary: 'Create a new production plan' })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Post(':id/release')
  @RequirePermissions('RELEASE_WO')
  @ApiOperation({ summary: 'Release a work order for production' })
  release(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.releaseWorkOrder(id);
  }

  @Patch(':id')
  @RequirePermissions('MANAGE_PLANS')
  @ApiOperation({ summary: 'Update plan details' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('MANAGE_PLANS')
  @ApiOperation({ summary: 'Delete a plan (only if kit is cancelled or missing)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.remove(id);
  }
}
