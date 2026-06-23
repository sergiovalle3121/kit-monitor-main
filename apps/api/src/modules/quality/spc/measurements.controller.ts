import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { MeasurementsService } from './measurements.service';
import type { CreateMeasurementsDto, ListMeasurementsQuery } from './dto';

/**
 * Variable/attribute measurements against a CTQ — the data SPC will consume.
 * GET endpoints return a time-ordered series + a descriptive summary; there is
 * deliberately NO control-limit or Cpk endpoint here (that is the SPC PR).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quality/measurements')
export class MeasurementsController {
  constructor(private readonly service: MeasurementsService) {}

  @Post()
  @RequirePermissions('QUALITY_WRITE')
  create(@Body() dto: CreateMeasurementsDto) {
    return this.service.createBatch(dto);
  }

  @Get()
  list(@Query() query: ListMeasurementsQuery) {
    return this.service.list(query);
  }

  @Get('summary')
  summary(@Query() query: ListMeasurementsQuery) {
    return this.service.summary(query);
  }
}
