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
import { FloorQualityService } from './floor-quality.service';
import { CreateHoldDto, DispositionDto, ReinspectDto } from './dto/floor-quality.dto';

/**
 * Floor quality — hold → MRB → disposition (Block F). Placing a hold needs
 * quality:hold; dispositions/rework/close need quality:disposition; reads need
 * quality:read. A hold quarantines and blocks the WO's consumption & shipment.
 */
@ApiTags('Floor Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('floor-quality')
export class FloorQualityController {
  constructor(private readonly service: FloorQualityService) {}

  @Get('holds')
  @RequirePermissions('quality:read')
  @ApiOperation({ summary: 'Cola de holds / NCRs (filtros status, part).' })
  list(@Query('status') status?: string, @Query('part') part?: string) {
    return this.service.listHolds({ status, part });
  }

  @Get('kpis')
  @RequirePermissions('quality:read')
  @ApiOperation({ summary: 'KPIs: PPM/holds, scrap, retrabajo, ciclo de disposición, %use-as-is.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('where-used')
  @RequirePermissions('quality:read')
  @ApiOperation({ summary: 'Contención: dónde se consumió un NP (genealogía).' })
  whereUsed(@Query('part') part: string, @Query('serial') serial?: string) {
    return this.service.whereUsed(part, serial);
  }

  @Get('holds/:id')
  @RequirePermissions('quality:read')
  @ApiOperation({ summary: 'Detalle de un hold.' })
  getOne(@Param('id') id: string) {
    return this.service.getHold(id);
  }

  @Post('holds')
  @RequirePermissions('quality:hold')
  @ApiOperation({ summary: 'Crea un hold (cuarentena + bloquea la WO).' })
  create(@Body() dto: CreateHoldDto) {
    return this.service.createHold(dto);
  }

  @Post('holds/:id/mrb')
  @RequirePermissions('quality:hold')
  @ApiOperation({ summary: 'Envía el hold a revisión MRB.' })
  toMrb(@Param('id') id: string) {
    return this.service.toMrb(id);
  }

  @Post('holds/:id/disposition')
  @RequirePermissions('quality:disposition')
  @ApiOperation({ summary: 'Dispone el material (requiere firma; USE_AS_IS→waiver, RTV→SCAR).' })
  disposition(@Param('id') id: string, @Body() dto: DispositionDto) {
    return this.service.disposition(id, dto);
  }

  @Post('holds/:id/rework')
  @RequirePermissions('quality:disposition')
  @ApiOperation({ summary: 'Abre la orden de retrabajo (REWORK/REPAIR).' })
  rework(@Param('id') id: string) {
    return this.service.startRework(id);
  }

  @Post('holds/:id/reinspect')
  @RequirePermissions('quality:disposition')
  @ApiOperation({ summary: 'Re-inspección: pasa (libera) o falla (vuelve a retrabajo).' })
  reinspect(@Param('id') id: string, @Body() dto: ReinspectDto) {
    return this.service.reinspect(id, dto);
  }

  @Post('holds/:id/close')
  @RequirePermissions('quality:disposition')
  @ApiOperation({ summary: 'Cierra el hold (libera la WO si no quedan holds abiertos).' })
  close(@Param('id') id: string) {
    return this.service.close(id);
  }
}
