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
import { RmaService } from './rma.service';
import { CreateRmaDto, TransitionRmaDto } from './dto/rma.dto';

@ApiTags('RMA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rma')
export class RmaController {
  constructor(private readonly service: RmaService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de RMA: abiertas, cierre promedio, disposición.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista casos RMA (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('customerName') customerName?: string,
  ) {
    return this.service.list({ status, customerName });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un caso RMA.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Abre un caso RMA / queja (folio RMA-).' })
  create(@Body() dto: CreateRmaDto) {
    return this.service.create(dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Avanza el RMA (investigar/disponer/cerrar).' })
  transition(@Param('id') id: string, @Body() dto: TransitionRmaDto) {
    return this.service.transition(id, dto);
  }
}
