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

  // Quarantine Transfers
  @Get('transfers')
  async getTransfers() {
    return this.qualityService.findTransfers();
  }

  @Post('transfers')
  async requestTransfer(@Body() dto: any) {
    return this.qualityService.requestQuarantineTransfer(dto);
  }

  @Patch('transfers/:id/complete')
  async completeTransfer(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.completeQuarantineTransfer(id, actor);
  }
}
