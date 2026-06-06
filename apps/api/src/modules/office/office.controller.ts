import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { OfficeService } from './office.service';
import type { OfficeDocType } from './entities/office-document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('office-documents')
export class OfficeController {
  constructor(private readonly service: OfficeService) {}

  @Get()
  list(@Query('type') type?: OfficeDocType) {
    return this.service.list(type);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: { type: OfficeDocType; title?: string; content?: any; model?: string }, @Request() req: any) {
    return this.service.create(dto, req.user?.email);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: { title?: string; content?: any; model?: string | null }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
