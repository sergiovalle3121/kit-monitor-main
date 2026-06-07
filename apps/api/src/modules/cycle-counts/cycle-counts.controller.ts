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
import { CycleCountsService } from './cycle-counts.service';
import {
  CreateCycleCountDto,
  RecordCountDto,
  TransitionCycleCountDto,
} from './dto/cycle-counts.dto';

@ApiTags('Cycle Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cycle-counts')
export class CycleCountsController {
  constructor(private readonly service: CycleCountsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs: exactitud de inventario, varianza, ajustes.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista conteos cíclicos (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('partNumber') partNumber?: string,
  ) {
    return this.service.list({ status, partNumber });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un conteo.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un conteo cíclico (folio CC-).' })
  create(@Body() dto: CreateCycleCountDto) {
    return this.service.create(dto);
  }

  @Post(':id/count')
  @ApiOperation({ summary: 'Registra la cantidad contada (calcula varianza).' })
  recordCount(@Param('id') id: string, @Body() dto: RecordCountDto) {
    return this.service.recordCount(id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Reconcilia o ajusta el conteo.' })
  transition(@Param('id') id: string, @Body() dto: TransitionCycleCountDto) {
    return this.service.transition(id, dto);
  }
}
