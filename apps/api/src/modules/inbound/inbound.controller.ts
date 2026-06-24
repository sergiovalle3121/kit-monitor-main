import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { InboundService } from './inbound.service';
import { CreateReceiptDto, TransitionReceiptDto } from './dto/inbound.dto';

@ApiTags('Inbound')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inbound')
export class InboundController {
  constructor(private readonly service: InboundService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de recibo: dock-to-stock, % rechazo, IQC.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Lista recibos (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('partNumber') partNumber?: string,
    @Query('poFolio') poFolio?: string,
  ) {
    return this.service.list({ status, partNumber, poFolio });
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Detalle de un recibo.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('receipts')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Captura un recibo de material (folio RCV-).' })
  create(@Body() dto: CreateReceiptDto) {
    return this.service.create(dto);
  }

  @Post('receipts/:id/transition')
  @RequirePermissions('materials:write')
  @ApiOperation({ summary: 'Avanza el recibo por su flujo IQC.' })
  transition(@Param('id') id: string, @Body() dto: TransitionReceiptDto) {
    return this.service.transition(id, dto);
  }
}
