import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { KitsService } from './kits.service';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';

@Controller('kits')
export class KitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Get()
  findAll() {
    return this.kitsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kitsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateKitDto) {
    return this.kitsService.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKitStatusDto) {
    return this.kitsService.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.kitsService.remove(id);
  }
}
