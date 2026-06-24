import {
  Controller, Get, Post, Delete,
  Param, Body, Query, ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BayLayoutService } from './bay-layout.service';
import { CreateBayLayoutDto } from './dto/create-bay-layout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bay-layouts')
export class BayLayoutController {
  constructor(private readonly service: BayLayoutService) {}

  /** GET /api/bay-layouts?model=MOD-1 */
  @Get()
  findByModel(@Query('model') model: string) {
    return this.service.findByModel(model);
  }

  /** POST /api/bay-layouts  — single row */
  @Post()
  @RequirePermissions('engineering:write')
  create(@Body() dto: CreateBayLayoutDto) {
    return this.service.create(dto);
  }

  /** POST /api/bay-layouts/bulk  — array of rows */
  @Post('bulk')
  @RequirePermissions('engineering:write')
  createBulk(@Body() dtos: CreateBayLayoutDto[]) {
    return this.service.createBulk(dtos);
  }

  /** DELETE /api/bay-layouts/:id */
  @Delete(':id')
  @RequirePermissions('engineering:write')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /** DELETE /api/bay-layouts/model/:model  — borra todo el layout de un modelo */
  @Delete('model/:model')
  @RequirePermissions('engineering:write')
  removeByModel(@Param('model') model: string) {
    return this.service.removeByModel(model);
  }
}
