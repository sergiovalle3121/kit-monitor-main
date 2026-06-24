import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { KitMaterialsService } from './kit-materials.service';
import { CreateKitMaterialDto } from './dto/create-kit-material.dto';
import { UpdateKitMaterialDto } from './dto/update-kit-material.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('kit-materials')
export class KitMaterialsController {
  constructor(private readonly service: KitMaterialsService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  @RequirePermissions('materials:write')
  create(@Body() dto: CreateKitMaterialDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('materials:write')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKitMaterialDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('materials:write')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
