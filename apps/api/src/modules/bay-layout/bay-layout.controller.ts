import {
  Controller, Get, Post, Delete,
  Param, Body, Query, ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BayLayoutService } from './bay-layout.service';
import { CreateBayLayoutDto } from './dto/create-bay-layout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bay-layouts')
export class BayLayoutController {
  constructor(private readonly service: BayLayoutService) {}

  /** GET /api/bay-layouts?model=OP-320-1211A */
  @Get()
  findByModel(@Query('model') model: string) {
    return this.service.findByModel(model);
  }

  /** POST /api/bay-layouts  — single row */
  @Post()
  create(@Body() dto: CreateBayLayoutDto) {
    return this.service.create(dto);
  }

  /** POST /api/bay-layouts/bulk  — array of rows */
  @Post('bulk')
  createBulk(@Body() dtos: CreateBayLayoutDto[]) {
    return this.service.createBulk(dtos);
  }

  /** DELETE /api/bay-layouts/:id */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /** DELETE /api/bay-layouts/model/:model  — borra todo el layout de un modelo */
  @Delete('model/:model')
  removeByModel(@Param('model') model: string) {
    return this.service.removeByModel(model);
  }
}
