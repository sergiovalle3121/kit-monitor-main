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
}
