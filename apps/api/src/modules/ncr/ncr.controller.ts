import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { NcrService } from './ncr.service';
import { NcrStatus } from './entities/ncr.entity';

@Controller('ncr')
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Get()
  async findAll(@Query() filters: any) {
    return this.ncrService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.ncrService.findOne(id);
  }

  @Post()
  async create(@Body() dto: any) {
    return this.ncrService.create(dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: number,
    @Body('status') status: NcrStatus,
    @Body('actor') actor: string
  ) {
    return this.ncrService.updateStatus(id, status, actor);
  }
}
