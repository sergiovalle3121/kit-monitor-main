import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
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

  // Dispositions
  @Get('dispositions')
  async getDispositions() {
    return this.qualityService.findDispositions();
  }

  @Post('dispositions')
  async proposeDisposition(@Body() dto: any) {
    return this.qualityService.proposeDisposition(dto);
  }

  @Patch('dispositions/:id/approve')
  async approveDisposition(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.approveDisposition(id, actor);
  }

  @Patch('dispositions/:id/execute')
  async executeDisposition(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.executeDisposition(id, actor);
  }

  // CAPA
  @Get('capas')
  async getCapas(@Query() filters: any) {
    return this.qualityService.findCapas(filters);
  }

  @Post('capas')
  async createCapa(@Body() dto: any) {
    return this.qualityService.createCapa(dto);
  }

  @Patch('capas/:id')
  async updateCapa(@Param('id') id: number, @Body() dto: any, @Body('actor') actor: string) {
    return this.qualityService.updateCapa(id, dto, actor || 'QA User');
  }

  // IQC
  @Get('iqc')
  async getIqc(@Query() filters: any) {
    return this.qualityService.findIqcInspections(filters);
  }

  @Post('iqc')
  async recordIqc(@Body() dto: any) {
    return this.qualityService.recordIqcInspection(dto);
  }

  // OQC Endpoints
  @Get('oqc/backlog')
  async getOqcBacklog() {
    return this.qualityService.getPendingOqcBacklog();
  }

  @Post('oqc/inspections')
  async recordOqc(@Body() dto: any) {
    return this.qualityService.recordFinalInspection(dto);
  }

  @Get('oqc/history')
  async getOqcHistory(@Query('partNumber') partNumber?: string) {
    return this.qualityService.getOqcHistory(partNumber);
  }
}
