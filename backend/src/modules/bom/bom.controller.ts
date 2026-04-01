import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { BomService } from './bom.service';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';

@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get()
  findAll(@Query('model') model?: string) {
    return this.bomService.findAll(model);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBomItemDto) {
    return this.bomService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBomItemDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.remove(id);
  }
}
