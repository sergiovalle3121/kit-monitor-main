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
import { TestingService } from './testing.service';
import { CreateTestRecordDto } from './dto/testing.dto';

@ApiTags('Testing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('testing')
export class TestingController {
  constructor(private readonly service: TestingService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de pruebas: yield, FPY y Pareto de fallas.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('records')
  @ApiOperation({ summary: 'Lista registros de prueba (con filtros).' })
  list(
    @Query('result') result?: string,
    @Query('station') station?: string,
    @Query('serialNumber') serialNumber?: string,
    @Query('model') model?: string,
  ) {
    return this.service.list({ result, station, serialNumber, model });
  }

  @Get('records/recent')
  @ApiOperation({ summary: 'Registros recientes para la pantalla de captura.' })
  recent(@Query('limit') limit?: string) {
    return this.service.recent(limit ? Number(limit) : 50);
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'Detalle de un registro de prueba.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('records')
  @ApiOperation({ summary: 'Captura un resultado de prueba (folio TST-).' })
  create(@Body() dto: CreateTestRecordDto) {
    return this.service.create(dto);
  }
}
