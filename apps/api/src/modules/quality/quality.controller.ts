import { Controller, Get, Post, Body, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { QualityService } from './quality.service';
import { QualityHoldLevel } from './entities/quality-hold.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quality')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('holds/active')
  async getActiveHolds() {
    return this.qualityService.findAllActiveHolds();
  }

  // Certifica (firma electrónica + folio oficial + registro inmutable) un CoC. El
  // firmante es la identidad de la SESIÓN (no del body): así la atestación del
  // ledger es atribuible de verdad. Solo requiere sesión (como los GET de calidad).
  @Post('coc/certify')
  async certifyCoc(
    @Req() req: any,
    @Body() dto: { subjectType?: string; subject?: string; contentHash?: string },
  ) {
    const actor = req.user?.email || req.user?.name || req.user?.userId || 'sistema';
    return this.qualityService.certifyCoc(dto, actor);
  }

  @Post('holds')
  @RequirePermissions('QUALITY_WRITE')
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
  @RequirePermissions('QUALITY_APPROVE')
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
  @RequirePermissions('QUALITY_WRITE')
  async requestTransfer(@Body() dto: any) {
    return this.qualityService.requestQuarantineTransfer(dto);
  }

  @Patch('transfers/:id/complete')
  @RequirePermissions('QUALITY_WRITE')
  async completeTransfer(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.completeQuarantineTransfer(id, actor);
  }

  // Dispositions
  @Get('dispositions')
  async getDispositions() {
    return this.qualityService.findDispositions();
  }

  @Post('dispositions')
  @RequirePermissions('QUALITY_WRITE')
  async proposeDisposition(@Body() dto: any) {
    return this.qualityService.proposeDisposition(dto);
  }

  @Patch('dispositions/:id/approve')
  @RequirePermissions('QUALITY_APPROVE')
  async approveDisposition(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.approveDisposition(id, actor);
  }

  @Patch('dispositions/:id/execute')
  @RequirePermissions('QUALITY_WRITE')
  async executeDisposition(@Param('id') id: number, @Body('actor') actor: string) {
    return this.qualityService.executeDisposition(id, actor);
  }

  // CAPA
  @Get('capas')
  async getCapas(@Query() filters: any) {
    return this.qualityService.findCapas(filters);
  }

  @Post('capas')
  @RequirePermissions('QUALITY_WRITE')
  async createCapa(@Body() dto: any) {
    return this.qualityService.createCapa(dto);
  }

  @Patch('capas/:id')
  @RequirePermissions('QUALITY_APPROVE')
  async updateCapa(@Param('id') id: number, @Body() dto: any, @Body('actor') actor: string) {
    return this.qualityService.updateCapa(id, dto, actor || 'QA User');
  }

  // IQC
  @Get('iqc')
  async getIqc(@Query() filters: any) {
    return this.qualityService.findIqcInspections(filters);
  }

  @Post('iqc')
  @RequirePermissions('QUALITY_WRITE')
  async recordIqc(@Body() dto: any) {
    return this.qualityService.recordIqcInspection(dto);
  }

  // OQC Endpoints
  @Get('oqc/backlog')
  async getOqcBacklog() {
    return this.qualityService.getPendingOqcBacklog();
  }

  @Post('oqc/inspections')
  @RequirePermissions('QUALITY_WRITE')
  async recordOqc(@Body() dto: any) {
    return this.qualityService.recordFinalInspection(dto);
  }

  @Get('oqc/history')
  async getOqcHistory(@Query('partNumber') partNumber?: string) {
    return this.qualityService.getOqcHistory(partNumber);
  }
}
