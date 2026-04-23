import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  async findAll() {
    return this.shippingService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.shippingService.findOne(id);
  }

  @Post()
  async create(@Body() dto: any) {
    return this.shippingService.create(dto);
  }

  @Post(':id/items')
  async addItem(@Param('id') id: number, @Body() itemDto: any) {
    return this.shippingService.addItem(id, itemDto);
  }

  @Post(':id/packing-list')
  async generatePackingList(@Param('id') id: number, @Body('actor') actor: string) {
    return this.shippingService.generatePackingList(id, actor);
  }

  @Patch(':id/start-loading')
  async startLoading(@Param('id') id: number, @Body() manifestDto: any) {
    return this.shippingService.startLoading(id, manifestDto);
  }

  @Patch(':id/dispatch')
  async dispatch(@Param('id') id: number, @Body('actor') actor: string) {
    return this.shippingService.dispatch(id, actor);
  }

  @Patch(':id/close')
  async close(@Param('id') id: number) {
    return this.shippingService.closeShipment(id);
  }
}
