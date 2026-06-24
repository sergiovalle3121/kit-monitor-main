import { Controller, Get, Post, Patch, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ResuppliesService } from './resupplies.service';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UpdateResupplyStatusDto } from './dto/update-resupply-status.dto';
import { AssignResupplyOwnerDto } from './dto/assign-resupply-owner.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('resupplies')
export class ResuppliesController {
  constructor(private readonly service: ResuppliesService) {}

  @Get()
  find(
    @Query('kitId') kitId?: string,
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    const scope = { line, model, workOrder, buildingId, programId };
    if (kitId) return this.service.findByKit(Number(kitId), scope);
    return this.service.findAll(scope);
  }

  @Post()
  @RequirePermissions('materials:write')
  create(@Body() dto: CreateResupplyDto) {
    return this.service.create(dto);
  }

  @Patch(':id/deliver')
  @RequirePermissions('materials:write')
  deliver(@Param('id', ParseIntPipe) id: number, @Body() dto: DeliverResupplyDto) {
    return this.service.deliver(id, dto);
  }


  @Patch(':id/owner')
  @RequirePermissions('materials:write')
  assignOwner(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignResupplyOwnerDto) {
    return this.service.assignOwner(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('materials:write')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResupplyStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
