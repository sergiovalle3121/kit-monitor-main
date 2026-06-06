import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MaterialRequestsService } from './material-requests.service';
import { CreateMaterialRequestDto } from './dto/create-material-request.dto';
import { DecideMaterialRequestDto } from './dto/decide-material-request.dto';
import type { MaterialRequestStatus } from './request-state';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(private readonly service: MaterialRequestsService) {}

  @Get()
  findAll(
    @Query('kitId') kitId?: string,
    @Query('status') status?: MaterialRequestStatus,
  ) {
    return this.service.findAll({
      kitId: kitId ? Number(kitId) : undefined,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /** Production raises a material request against a published kit. */
  @Post()
  @RequirePermissions('materials:request')
  create(@Body() dto: CreateMaterialRequestDto, @Request() req: any) {
    const actor = req.user?.email ?? dto.requestedBy ?? 'system';
    return this.service.create(dto, actor);
  }

  /** Warehouse authorizes the request (emits a socket event to production). */
  @Post(':id/authorize')
  @RequirePermissions('materials:authorize')
  authorize(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideMaterialRequestDto,
    @Request() req: any,
  ) {
    return this.service.authorize(id, dto, req.user?.email ?? 'system');
  }

  @Post(':id/reject')
  @RequirePermissions('materials:authorize')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideMaterialRequestDto,
    @Request() req: any,
  ) {
    return this.service.reject(id, dto, req.user?.email ?? 'system');
  }

  @Post(':id/fulfill')
  @RequirePermissions('materials:authorize')
  fulfill(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideMaterialRequestDto,
    @Request() req: any,
  ) {
    return this.service.fulfill(id, dto, req.user?.email ?? 'system');
  }
}
