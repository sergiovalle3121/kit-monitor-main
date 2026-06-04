import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { TCodeService } from '../services/tcode.service';
import { ExecuteTCodeDto } from '../dto/execute-tcode.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('tcode')
@UseGuards(JwtAuthGuard)
export class TCodeController {
  constructor(private readonly tCodeService: TCodeService) {}

  @Post('execute')
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
