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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, TransitionExpenseDto } from './dto/expenses.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de gastos: pendientes, reembolsado, promedio.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista reportes de gasto (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('employeeName') employeeName?: string,
  ) {
    return this.service.list({ status, employeeName });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un reporte de gasto.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un reporte de gasto (folio EXP-).' })
  create(@Body() dto: CreateExpenseDto) {
    return this.service.create(dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Avanza el gasto (enviar/aprobar/rechazar/reembolsar).' })
  transition(@Param('id') id: string, @Body() dto: TransitionExpenseDto) {
    return this.service.transition(id, dto);
  }
}
