import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { TCodeService } from '../services/tcode.service';
import { ExecuteTCodeDto } from '../dto/execute-tcode.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';

@Controller('tcode')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TCodeController {
  constructor(private readonly tCodeService: TCodeService) {}

  @Post('execute')
  @RequirePermissions('ADMIN_ACCESS')
  async executeTCode(@Body() dto: ExecuteTCodeDto) {
    return this.tCodeService.executeTCode(dto);
  }

  @Get('list')
  async getAllTCodes() {
    return this.tCodeService.getAllTCodes();
  }

  @Get('search')
  async searchTCodes(@Query('q') query: string) {
    return this.tCodeService.searchTCodes(query);
  }
}
