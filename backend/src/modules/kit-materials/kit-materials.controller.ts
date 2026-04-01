import { Controller, Get, Post, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { KitMaterialsService } from './kit-materials.service';
import { CreateKitMaterialDto } from './dto/create-kit-material.dto';

@Controller('kit-materials')
export class KitMaterialsController {
  constructor(private readonly service: KitMaterialsService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  create(@Body() dto: CreateKitMaterialDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
