import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PickListService } from './pick-list.service';
import { PublishPlanDto } from './dto/publish-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pick-lists')
export class PickListController {
  constructor(private readonly service: PickListService) {}

  /** Planning publishes a plan → explode BOM → generate the warehouse PickList. */
  @Post()
  @RequirePermissions('RELEASE_WO')
  publish(@Body() dto: PublishPlanDto, @Request() req: any) {
    const actor = req.user?.email ?? dto.actor ?? 'system';
    return this.service.publishPlan(dto.planId, actor);
  }

  /** Materials a plan would pull, derived from the model's ACTIVE BOM (no commit). */
  @Get('preview/:planId')
  preview(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.previewPlan(planId);
  }

  @Get(':planId')
  getByPlan(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.getByPlan(planId);
  }
}
