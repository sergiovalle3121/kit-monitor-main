import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { OutboundService } from './outbound.service';
import { OutboundLinesService } from './outbound-lines.service';
import {
  AssignTransportDto,
  CreateOutboundLineDto,
  CreateShipmentDto,
  TransitionShipmentDto,
  UpdateOutboundLineDto,
  UpdateShipmentDto,
} from './dto/outbound.dto';

@ApiTags('Outbound')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('outbound')
export class OutboundController {
  constructor(
    private readonly service: OutboundService,
    private readonly linesService: OutboundLinesService,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de embarque: por embarcar, en tránsito, OTD.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('shipments')
  @ApiOperation({ summary: 'Lista embarques (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('customerName') customerName?: string,
    @Query('programId') programId?: string,
  ) {
    return this.service.list({ status, customerName, programId });
  }

  @Get('shipments/:id')
  @ApiOperation({ summary: 'Detalle de un embarque.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('shipments')
  @ApiOperation({ summary: 'Crea un embarque (folio SHP-).' })
  create(@Body() dto: CreateShipmentDto) {
    return this.service.create(dto);
  }

  @Patch('shipments/:id')
  @ApiOperation({ summary: 'Actualiza un embarque.' })
  update(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    return this.service.update(id, dto);
  }

  @Post('shipments/:id/transition')
  @ApiOperation({ summary: 'Avanza el embarque (genera ASN al embarcar).' })
  transition(@Param('id') id: string, @Body() dto: TransitionShipmentDto) {
    return this.service.transition(id, dto);
  }

  // ── Contenido (líneas del embarque) ────────────────────────────────────────

  @Get('shipments/:id/lines')
  @ApiOperation({ summary: 'Líneas (contenido) del embarque.' })
  lines(@Param('id') id: string) {
    return this.linesService.listLines(id);
  }

  @Post('shipments/:id/lines')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Agrega una línea de contenido al embarque.' })
  addLine(@Param('id') id: string, @Body() dto: CreateOutboundLineDto) {
    return this.linesService.addLine(id, dto);
  }

  @Patch('lines/:lineId')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Actualiza una línea de contenido.' })
  updateLine(@Param('lineId') lineId: string, @Body() dto: UpdateOutboundLineDto) {
    return this.linesService.updateLine(lineId, dto);
  }

  @Delete('lines/:lineId')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Elimina una línea de contenido.' })
  removeLine(@Param('lineId') lineId: string) {
    return this.linesService.removeLine(lineId);
  }

  @Get('shipments/:id/asn')
  @ApiOperation({ summary: 'ASN jerárquico (embarque → tarima → caja → ítem) + totales.' })
  asn(@Param('id') id: string) {
    return this.service.assembleAsn(id);
  }

  @Get('shipments/:id/asn.edi')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'ASN como EDI 856 (archivo plano) para descarga.' })
  asnEdi(@Param('id') id: string) {
    return this.service.asnEdi(id);
  }

  @Get('shipments/:id/packing-list')
  @ApiOperation({ summary: 'Lista de empaque (una fila por línea de contenido) + totales.' })
  packingList(@Param('id') id: string) {
    return this.service.assemblePackingList(id);
  }

  @Get('shipments/:id/packing-list.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Lista de empaque en CSV para descarga.' })
  packingListCsv(@Param('id') id: string) {
    return this.service.packingListCsvText(id);
  }

  @Get('shipments/:id/bol')
  @ApiOperation({ summary: 'Bill of Lading (carta de embarque).' })
  bol(@Param('id') id: string) {
    return this.service.assembleBol(id);
  }

  @Get('shipments/:id/carta-porte')
  @ApiOperation({ summary: 'Carta Porte (MX, CFDI 3.1) — datos + requisitos de configuración.' })
  cartaPorte(@Param('id') id: string) {
    return this.service.assembleCartaPorte(id);
  }

  @Get('shipments/:id/invoice')
  @ApiOperation({ summary: 'Factura comercial (desde líneas con precio).' })
  invoice(@Param('id') id: string) {
    return this.service.assembleInvoice(id);
  }

  @Get('shipments/:id/coc')
  @ApiOperation({ summary: 'Certificado de Conformancia (CoC) del embarque.' })
  coc(@Param('id') id: string) {
    return this.service.assembleCoc(id);
  }

  @Post('shipments/:id/assign-transport')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Asigna transporte (transportista/unidad/chofer/andén) con poka-yoke.' })
  assignTransport(@Param('id') id: string, @Body() dto: AssignTransportDto) {
    return this.service.assignTransport(id, dto);
  }

  @Post('shipments/:id/release-transport')
  @RequirePermissions('logistics:write')
  @ApiOperation({ summary: 'Libera el transporte asignado (regresa unidad/chofer/andén a disponible).' })
  releaseTransport(@Param('id') id: string) {
    return this.service.releaseTransport(id);
  }
}
