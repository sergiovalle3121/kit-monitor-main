import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

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
    return this.suppliersService.findAll({ q, qualification, type, status });
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

  @Get(':id')
  async getOne(@Param('id') id: number) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: number, @Body() dto: any) {
    return this.suppliersService.update(id, dto);
  }
}
