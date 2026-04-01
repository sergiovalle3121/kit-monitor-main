import { Controller, Get, Post, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto } from './dto/create-advance.dto';

@Controller('advances')
export class AdvancesController {
  constructor(private readonly service: AdvancesService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  create(@Body() dto: CreateAdvanceDto) {
    return this.service.create(dto);
  }
}
