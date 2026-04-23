import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  async getAll() {
    return this.suppliersService.findAll();
  }

  @Post()
  async create(@Body() dto: any) {
    return this.suppliersService.create(dto);
  }

  // SCARs
  @Get('scars')
  async getScars(@Param() filters: any) {
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
}
