import { Controller, Get, Post, Body } from '@nestjs/common';
import { ReplenishmentService } from './replenishment.service';

@Controller('replenishment')
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Get('rules')
  async getRules() {
    return this.replenishmentService.getRules();
  }

  @Post('rules')
  async createRule(@Body() dto: any) {
    return this.replenishmentService.createRule(dto);
  }

  @Get('analyze')
  async analyze() {
    return this.replenishmentService.analyzeInventory();
  }
}
