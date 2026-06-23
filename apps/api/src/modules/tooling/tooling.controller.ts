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
import { ToolingService } from './tooling.service';
import {
  CheckinToolDto,
  CheckoutToolDto,
  CreateToolDto,
  RecordCalibrationDto,
  RecordPmDto,
  RecordUsageDto,
  SetToolStatusDto,
} from './dto/tooling.dto';

@ApiTags('Tooling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tooling')
export class ToolingController {
  constructor(private readonly service: ToolingService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de herramentales: vida, EOL, préstamos, calibración.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista herramentales (vida derivada + préstamo activo).' })
  list(@Query('status') status?: string, @Query('type') type?: string) {
    return this.service.list({ status, type });
  }

  @Post('alerts/scan')
  @ApiOperation({ summary: 'Barre EOL + calibración y despacha alertas al buzón (deduplicado).' })
  scanAlerts() {
    return this.service.scanAlerts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un herramental.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Historial denso: préstamos por WO + uso (del ledger).' })
  history(@Param('id') id: string) {
    return this.service.history(id);
  }

  @Get(':id/checkouts')
  @ApiOperation({ summary: 'Historial de préstamos del herramental.' })
  checkouts(@Param('id') id: string) {
    return this.service.listCheckouts(id);
  }

  @Post()
  @ApiOperation({ summary: 'Da de alta un herramental (folio TL-).' })
  create(@Body() dto: CreateToolDto) {
    return this.service.create(dto);
  }

  @Post(':id/usage')
  @ApiOperation({ summary: 'Registra disparos de uso (suma a la vida).' })
  recordUsage(@Param('id') id: string, @Body() dto: RecordUsageDto) {
    return this.service.recordUsage(id, dto);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Cambia el estado del herramental.' })
  setStatus(@Param('id') id: string, @Body() dto: SetToolStatusDto) {
    return this.service.setStatus(id, dto);
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Presta el herramental a una WO (check-out → IN_USE).' })
  checkout(@Param('id') id: string, @Body() dto: CheckoutToolDto) {
    return this.service.checkout(id, dto);
  }

  @Post(':id/checkin')
  @ApiOperation({ summary: 'Recibe el herramental de una WO (check-in → AVAILABLE).' })
  checkin(@Param('id') id: string, @Body() dto: CheckinToolDto) {
    return this.service.checkin(id, dto);
  }

  @Post(':id/calibration')
  @ApiOperation({ summary: 'Registra calibración (fecha y próxima/intervalo).' })
  recordCalibration(@Param('id') id: string, @Body() dto: RecordCalibrationDto) {
    return this.service.recordCalibration(id, dto);
  }

  @Post(':id/pm')
  @ApiOperation({ summary: 'Registra mantenimiento preventivo (fecha y próximo/intervalo).' })
  recordPm(@Param('id') id: string, @Body() dto: RecordPmDto) {
    return this.service.recordPm(id, dto);
  }
}
