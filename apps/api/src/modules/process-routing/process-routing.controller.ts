import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ProcessRoutingService } from './process-routing.service';
import { CreateStepDto, UpdateStepDto, AddStepMaterialDto } from './dto/process.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('process')
export class ProcessRoutingController {
  constructor(private readonly service: ProcessRoutingService) {}

  /** Ordered route (steps + materials) for a model. */
  @Get('routes')
  getRoute(@Query('model') model: string, @Query('revision') revision?: string) {
    return this.service.getRoute(model, revision);
  }

  @Post('steps')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions('engineering:write')
  createStep(@Body() dto: CreateStepDto) {
    return this.service.createStep(dto);
  }

  @Patch('steps/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions('engineering:write')
  updateStep(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStepDto) {
    return this.service.updateStep(id, dto);
  }

  @Delete('steps/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions('engineering:write')
  deleteStep(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteStep(id);
  }

  @Post('steps/:id/materials')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions('engineering:write')
  addMaterial(@Param('id', ParseIntPipe) id: number, @Body() dto: AddStepMaterialDto) {
    return this.service.addMaterial(id, dto);
  }

  @Delete('materials/:id')
  @UseGuards(JwtAuthGuard)
  @RequirePermissions('engineering:write')
  removeMaterial(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeMaterial(id);
  }
}
