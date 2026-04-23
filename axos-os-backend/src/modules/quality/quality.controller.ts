import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { QualityService } from './quality.service';
import { QualityHoldLevel } from './entities/quality-hold.entity';

@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('holds/active')
  async getActiveHolds() {
    return this.qualityService.findAllActiveHolds();
  }

  @Post('holds')
  async createHold(
    @Body() dto: {
      partNumber: string;
      level: QualityHoldLevel;
      levelValue?: string;
      reason: string;
      heldBy: string;
      notes?: string;
    }
  ) {
    return this.qualityService.createHold(dto);
  }

  @Patch('holds/:id/release')
  async releaseHold(
    @Param('id') id: number,
    @Body('releasedBy') releasedBy: string
  ) {
    return this.qualityService.releaseHold(id, releasedBy);
  }
}
