import { Controller, Get, Post, Patch, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  @RequirePermissions('production:write')
  create(@Body() dto: CreateExceptionDto) {
    return this.service.create(dto);
  }

  @Patch(':id/resolve')
  @RequirePermissions('production:write')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.service.resolve(id);
  }
}
