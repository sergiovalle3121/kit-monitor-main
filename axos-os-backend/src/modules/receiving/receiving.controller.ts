import { Controller, Get, Post, Body } from '@nestjs/common';
import { ReceivingService } from './receiving.service';

@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Get('events')
  async getEvents() {
    return this.receivingService.findAll();
  }

  @Post('receipt')
  async recordReceipt(@Body() dto: any) {
    return this.receivingService.recordReceipt(dto);
  }
}
