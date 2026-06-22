import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CustomerInsightsService } from './customer-insights.service';

@ApiTags('Customer 360')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customer-insights')
export class CustomerInsightsController {
  constructor(private readonly service: CustomerInsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Índice ejecutivo: clientes con rollup cross-departamental.' })
  list() {
    return this.service.list();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Cliente 360: comercial, programas, calidad, entrega y finanzas.' })
  customer360(@Param('code') code: string) {
    return this.service.customer360(code);
  }
}
