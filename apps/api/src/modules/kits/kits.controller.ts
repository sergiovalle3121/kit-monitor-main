import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { KitsService } from './kits.service';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('kits')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('kits')
export class KitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Get()
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'List kits for the current tenant' })
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
    return this.kitsService.findAll({ line, model, workOrder, buildingId, programId });
  }

  @Get(':id')
  @RequirePermissions('materials:read')
  @ApiOperation({ summary: 'Get a single kit with materials and advances' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kitsService.findOne(id);
  }

  @Post()
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Create a kit from a released plan' })
  create(@Body() dto: CreateKitDto) {
    return this.kitsService.create(dto);
  }

  @Patch(':id/start')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Mark kit preparation as started' })
  startPreparation(@Param('id', ParseIntPipe) id: number) {
    return this.kitsService.startPreparation(id);
  }

  @Patch(':id/status')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Update kit status (kitted, requested, delivered, etc.)' })
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKitStatusDto) {
    return this.kitsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Delete a kit and all its child records' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.kitsService.remove(id);
  }
}
