import { Controller, Get, Post, Patch, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ResuppliesService } from './resupplies.service';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateResupplyStatusDto } from './dto/update-resupply-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('resupplies')
export class ResuppliesController {
  constructor(private readonly service: ResuppliesService) {}

  @Get()
  findByKit(@Query('kitId', ParseIntPipe) kitId: number) {
    return this.service.findByKit(kitId);
  }

  @Post()
  create(@Body() dto: CreateResupplyDto) {
    return this.service.create(dto);
  }

  @Patch(':id/deliver')
  deliver(@Param('id', ParseIntPipe) id: number, @Body() dto: DeliverResupplyDto) {
    return this.service.deliver(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResupplyStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
