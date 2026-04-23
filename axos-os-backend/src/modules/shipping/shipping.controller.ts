import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermissions('SHIPPING_WRITE')
  async create(@Body() dto: any) {
    return this.shippingService.create(dto);
  }

  @Post(':id/items')
  @RequirePermissions('SHIPPING_WRITE')
  async addItem(@Param('id') id: number, @Body() itemDto: any) {
    return this.shippingService.addItem(id, itemDto);
  }

  @Post(':id/packing-list')
  @RequirePermissions('SHIPPING_WRITE')
  async generatePackingList(@Param('id') id: number, @Body('actor') actor: string) {
    return this.shippingService.generatePackingList(id, actor);
  }

  @Patch(':id/start-loading')
  @RequirePermissions('SHIPPING_WRITE')
  async startLoading(@Param('id') id: number, @Body() manifestDto: any) {
    return this.shippingService.startLoading(id, manifestDto);
  }

  @Patch(':id/dispatch')
  @RequirePermissions('DISPATCH')
  async dispatch(@Param('id') id: number, @Body('actor') actor: string) {
    return this.shippingService.dispatch(id, actor);
  }

  @Patch(':id/close')
  @RequirePermissions('SHIPPING_WRITE')
  async close(@Param('id') id: number) {
    return this.shippingService.closeShipment(id);
  }
}
