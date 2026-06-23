import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NcrService } from './ncr.service';
import { NcrStatus } from './entities/ncr.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

// Antes este controlador estaba SIN guards (acceso público de lectura y
// escritura a las NCR de cualquiera). Se cierra con JwtAuthGuard: las lecturas
// requieren sesión (como los GET de quality), las escrituras QUALITY_WRITE.
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ncr')
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Get()
  async findAll(@Query() filters: any) {
    return this.ncrService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return this.ncrService.findOne(id);
  }

  @Post()
  @RequirePermissions('QUALITY_WRITE')
  async create(@Body() dto: any) {
    return this.ncrService.create(dto);
  }

  @Patch(':id/status')
  @RequirePermissions('QUALITY_WRITE')
  async updateStatus(
    @Param('id') id: number,
    @Body('status') status: NcrStatus,
    @Body('actor') actor: string
  ) {
    return this.ncrService.updateStatus(id, status, actor);
  }

  // Aditivo: clasifica una NCR existente con un código de defecto del catálogo.
  // Enviar defectCodeId=null la regresa a «Sin clasificar». No altera el alta ni
  // el ciclo de la NCR.
  @Patch(':id/classify')
  @RequirePermissions('QUALITY_WRITE')
  async classify(
    @Param('id') id: number,
    @Body('defectCodeId') defectCodeId: number | null,
    @Body('actor') actor: string
  ) {
    return this.ncrService.classify(id, defectCodeId ?? null, actor);
  }
}
