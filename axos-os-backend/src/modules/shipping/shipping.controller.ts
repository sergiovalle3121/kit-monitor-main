import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @RequirePermissions('materials:read')
  async findAll(@Request() req: any) {
    return this.shippingService.findAll(req.user);
  }

  @Get(':id')
  @RequirePermissions('materials:read')
  async findOne(@Param('id') id: number, @Request() req: any) {
    return this.shippingService.findOne(id, req.user);
  }

  @Post()
  @RequirePermissions('materials:write')
  async create(@Body() dto: any, @Request() req: any) {
    return this.shippingService.create(dto, req.user);
  }

  @Post(':id/items')
  @RequirePermissions('materials:write')
  async addItem(@Param('id') id: number, @Body() itemDto: any, @Request() req: any) {
    return this.shippingService.addItem(id, itemDto, req.user);
  }

  @Post(':id/packing-list')
  @RequirePermissions('materials:write')
  async generatePackingList(@Param('id') id: number, @Body('actor') actor: string, @Request() req: any) {
    return this.shippingService.generatePackingList(id, actor, req.user);
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
