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
import { FaiService } from './fai.service';
import { CreateFaiDto, FaiQueryDto, SubmitFaiDto } from './dto/fai.dto';

/**
 * First Article Inspection (FAI / primera pieza) — block E. The first built unit
 * of a WO is measured and signed off; on PASS the WO's first-piece gate is freed
 * (a WO whose faiRequired is set will not run until a FAI passes). All actions
 * are gated on quality:report (the inspection permission line operators carry).
 */
@ApiTags('FAI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fai')
export class FaiController {
  constructor(private readonly service: FaiService) {}

  @Get()
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Lista FAIs (filtros woId, result, line).' })
  list(@Query() query: FaiQueryDto) {
    return this.service.list(query);
  }

  @Get('kpis')
  @RequirePermissions('quality:report')
  @ApiOperation({
    summary:
      'KPIs FAI: first-pass yield, pendientes, mediciones fuera de tolerancia.',
  })
  kpis() {
    return this.service.kpis();
  }

  @Get('by-wo/:woId')
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Historial de FAIs de una WO.' })
  byWo(@Param('woId') woId: string) {
    return this.service.byWo(woId);
  }

  @Get(':id')
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Detalle de una FAI.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Abre una FAI de primera pieza para una WO.' })
  create(@Body() dto: CreateFaiDto) {
    return this.service.create(dto);
  }

  @Post(':id/submit')
  @RequirePermissions('quality:report')
  @ApiOperation({
    summary:
      'Registra el veredicto (pass/fail) + mediciones + inspector. PASS libera la WO.',
  })
  submit(@Param('id') id: string, @Body() dto: SubmitFaiDto) {
    return this.service.submit(id, dto);
  }
}
