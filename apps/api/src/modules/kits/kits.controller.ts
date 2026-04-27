import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { KitsService } from './kits.service';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Request } from '@nestjs/common';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('kits')
export class KitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Get()
  @RequirePermissions('materials:read')
  findAll(
    @Request() req: any,
    @Query('line') line?: string,
    @Query('model') model?: string,
    @Query('workOrder') workOrder?: string,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.kitsService.findAll(req.user, { line, model, workOrder, buildingId, programId });
  }

  @Get(':id')
  @RequirePermissions('materials:read')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.kitsService.findOne(id, req.user);
  }

  @Post()
  @RequirePermissions('materials:write')
  create(@Body() dto: CreateKitDto, @Request() req: any) {
    return this.kitsService.create(dto, req.user);
  }

  @Patch(':id/start')
  @RequirePermissions('materials:write')
  startPreparation(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.kitsService.startPreparation(id, req.user);
  }

  @Patch(':id/status')
  @RequirePermissions('materials:write')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKitStatusDto, @Request() req: any) {
    return this.kitsService.updateStatus(id, dto, req.user);
  }

  @Delete(':id')
  @RequirePermissions('materials:write')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.kitsService.remove(id, req.user);
  }
}
