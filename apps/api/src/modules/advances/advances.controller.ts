import { Controller, Get, Post, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('advances')
export class AdvancesController {
  constructor(private readonly service: AdvancesService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  @RequirePermissions('production:report')
  create(@Body() dto: CreateAdvanceDto) {
    return this.service.create(dto);
  }
}
