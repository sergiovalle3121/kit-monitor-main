import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CancellationRequestsService } from './cancellation-requests.service';
import { CreateCancellationRequestDto } from './dto/create-cancellation-request.dto';
import { RespondCancellationRequestDto } from './dto/respond-cancellation-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

// Require authentication. This controller was fully public, allowing anonymous
// creation AND approval/rejection of work-order cancellation requests.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cancellation-requests')
export class CancellationRequestsController {
  constructor(private readonly service: CancellationRequestsService) {}

  @Post()
  @RequirePermissions('production:write')
  create(@Body() dto: CreateCancellationRequestDto) {
    return this.service.create(dto);
  }

  @Get('pending')
  findPending() {
    return this.service.findPending();
  }

  @Get('recent')
  findRecent() {
    return this.service.findRecent();
  }

  @Patch(':id/respond')
  @RequirePermissions('production:write')
  respond(@Param('id', ParseIntPipe) id: number, @Body() dto: RespondCancellationRequestDto) {
    return this.service.respond(id, dto);
  }
}
