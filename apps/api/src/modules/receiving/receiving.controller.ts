import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ReceivingService } from './receiving.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Get('events')
  @RequirePermissions('materials:read')
  async getEvents(@Request() req: any, @Query() filters: any) {
    return this.receivingService.findAll(req.user, filters);
  }

  @Post('receipt')
  @RequirePermissions('materials:write')
  async recordReceipt(@Body() dto: any, @Request() req: any) {
    return this.receivingService.recordReceipt(dto, req.user);
  }
}
