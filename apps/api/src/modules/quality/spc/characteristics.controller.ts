import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CharacteristicsService } from './characteristics.service';
import type {
  CreateCharacteristicDto,
  ListCharacteristicsQuery,
  UpdateCharacteristicDto,
} from './dto';

/**
 * CTQ catalog (SPC data foundation). Reads need only a session; writes require
 * QUALITY_WRITE — same posture as the rest of the quality module.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quality/characteristics')
export class CharacteristicsController {
  constructor(private readonly service: CharacteristicsService) {}

  @Get()
  list(@Query() query: ListCharacteristicsQuery) {
    return this.service.list(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @RequirePermissions('QUALITY_WRITE')
  create(@Body() dto: CreateCharacteristicDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('QUALITY_WRITE')
  update(@Param('id') id: string, @Body() dto: UpdateCharacteristicDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('QUALITY_WRITE')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
