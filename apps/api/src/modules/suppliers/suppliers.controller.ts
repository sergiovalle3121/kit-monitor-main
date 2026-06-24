import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Require authentication. This controller was fully public, allowing anonymous
// create/modify of suppliers, the Approved Vendor List and SCARs.
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async getAll(
    @Query('q') q?: string,
    @Query('qualification') qualification?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    // Enriched with the derived scorecard (grade / OTD / PPM) so the list ranks
    // by real performance. Still returns every supplier field, so it's additive.
    return this.suppliersService.findAllEnriched({ q, qualification, type, status });
  }

  @Post()
  async create(@Body() dto: any) {
    return this.suppliersService.create(dto);
  }

  // ── Static routes first (must precede ':id' so they aren't captured) ──
  @Get('kpis')
  async kpis() {
    return this.suppliersService.kpis();
  }

  // AVL — Approved Vendor List
  @Get('avl')
  async listAvl(
    @Query('supplierId') supplierId?: number,
    @Query('part') part?: string,
    @Query('status') status?: string,
  ) {
    return this.suppliersService.listAvl({ supplierId: supplierId ? Number(supplierId) : undefined, part, status });
  }

  @Post('avl')
  async addAvlPart(@Body() dto: any) {
    return this.suppliersService.addAvlPart(dto);
  }

  @Patch('avl/:aid')
  async updateAvlPart(@Param('aid') aid: number, @Body() dto: any) {
    return this.suppliersService.updateAvlPart(Number(aid), dto);
  }

  @Delete('avl/:aid')
  async removeAvlPart(@Param('aid') aid: number) {
    return this.suppliersService.removeAvlPart(Number(aid));
  }

  /** Buyer view: who is approved to supply this part, ranked by performance. */
  @Get('for-part')
  async forPart(@Query('part') part: string) {
    return this.suppliersService.forPart(part);
  }

  // SCARs
  @Get('scars')
  async getScars(@Query() filters: any) {
    return this.suppliersService.findScars(filters);
  }

  @Post('scars')
  async createScar(@Body() dto: any) {
    return this.suppliersService.createScar(dto);
  }

  @Patch('scars/:id')
  async updateScar(@Param('id') id: number, @Body() dto: any, @Body('actor') actor: string) {
    return this.suppliersService.updateScar(id, dto, actor || 'QA User');
  }

  // Scorecards
  @Get('scorecards')
  async getAllScorecards() {
    return this.suppliersService.getAllScorecards();
  }

  // Contacts
  @Post('contacts')
  async addContact(@Body() dto: any) {
    return this.suppliersService.addContact(dto);
  }

  @Patch('contacts/:cid')
  async updateContact(@Param('cid') cid: number, @Body() dto: any) {
    return this.suppliersService.updateContact(cid, dto);
  }

  @Delete('contacts/:cid')
  async removeContact(@Param('cid') cid: number) {
    return this.suppliersService.removeContact(cid);
  }

  // Certifications
  @Post('certifications')
  async addCertification(@Body() dto: any) {
    return this.suppliersService.addCertification(dto);
  }

  @Delete('certifications/:cid')
  async removeCertification(@Param('cid') cid: number) {
    return this.suppliersService.removeCertification(cid);
  }

  // ── Dynamic ':id' routes last ──
  @Get(':id/scorecard')
  async getScorecard(@Param('id') id: number) {
    return this.suppliersService.getScorecard(id);
  }

  @Get(':id/360')
  async supplier360(@Param('id') id: number) {
    return this.suppliersService.supplier360(id);
  }

  @Get(':id/contacts')
  async listContacts(@Param('id') id: number) {
    return this.suppliersService.listContacts(id);
  }

  @Get(':id/parts')
  async listParts(@Param('id') id: number) {
    return this.suppliersService.partsForSupplier(Number(id));
  }

  @Get(':id')
  async getOne(@Param('id') id: number) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: any) {
    return this.suppliersService.update(id, dto);
  }
}
