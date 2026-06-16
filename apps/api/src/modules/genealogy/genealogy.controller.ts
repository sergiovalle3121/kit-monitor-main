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
import { GenealogyService } from './genealogy.service';
import { LinkShipmentDto, RecordLinkDto } from './dto/genealogy.dto';

/**
 * Cradle-to-grave traceability (automotive grade). AS-BUILT by serial (the
 * inverse of where-used, which today only goes part→serials) and WHERE-USED by
 * lot/reel for recall containment (serials + shipments). Reads need
 * production:report / quality:report; forward-capture hooks reuse the same.
 */
@ApiTags('Genealogy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('genealogy')
export class GenealogyController {
  constructor(private readonly service: GenealogyService) {}

  @Get('as-built/by-serial/:serial')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary:
      'AS-BUILT por serie: árbol de qué lote/reel de cada NP se consumió (operador/estación/hora).',
  })
  asBuilt(@Param('serial') serial: string) {
    return this.service.asBuiltBySerial(serial);
  }

  @Get('where-used/by-lot')
  @RequirePermissions('quality:report')
  @ApiOperation({
    summary:
      'WHERE-USED inverso: dado un lote/reel defectuoso, qué series y embarques lo contienen (recall).',
  })
  whereUsed(
    @Query('lot') lot?: string,
    @Query('reel') reel?: string,
    @Query('part') part?: string,
  ) {
    return this.service.whereUsedByLot({ lot, reel, part });
  }

  @Get('links')
  @RequirePermissions('production:report')
  @ApiOperation({ summary: 'Inspección del índice de genealogía (filtros serial, part, lot).' })
  listLinks(
    @Query('serial') serial?: string,
    @Query('part') part?: string,
    @Query('lot') lot?: string,
  ) {
    return this.service.listLinks({ serial, part, lot });
  }

  @Get('kpis')
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Cobertura de genealogía: series, lotes, reels, embarques indexados.' })
  kpis() {
    return this.service.kpis();
  }

  @Post('links')
  @RequirePermissions('production:report')
  @ApiOperation({
    summary:
      'Registra un eslabón de genealogía (serial→lote/reel de NP). Hook aditivo, idempotente.',
  })
  recordLink(@Body() dto: RecordLinkDto) {
    return this.service.recordLink(dto);
  }

  @Post('shipment-links')
  @RequirePermissions('quality:report')
  @ApiOperation({ summary: 'Liga una serie a su embarque (cierra el camino al recall). Idempotente.' })
  linkShipment(@Body() dto: LinkShipmentDto) {
    return this.service.linkShipment(dto);
  }
}
