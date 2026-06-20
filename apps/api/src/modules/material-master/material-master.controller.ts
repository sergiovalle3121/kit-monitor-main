import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MaterialMasterService } from './material-master.service';
import {
  CreateAvlDto,
  CreateMaterialAltDto,
  CreateMaterialDto,
  TransitionMaterialDto,
  UpdateAvlDto,
  UpdateMaterialDto,
} from './dto/material.dto';

/**
 * Material Master (MM · Engineering) — the single source of parts. SAP-style
 * item types, make/buy, lifecycle, AVL (approved manufacturers) and alternates.
 * The new multi-level BOM and routing reference materials from here.
 */
@ApiTags('Material Master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material-master')
export class MaterialMasterController {
  constructor(private readonly service: MaterialMasterService) {}

  @Get()
  @ApiOperation({ summary: 'Lista materiales (búsqueda + filtro tipo/estado).' })
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('itemType') itemType?: string,
  ) {
    return this.service.list({ search, status, itemType });
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Conteos por estado, tipo y make/buy.' })
  kpis() {
    return this.service.kpis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un material.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un material (folio MAT- si no se da número).' })
  create(@Body() dto: CreateMaterialDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza los datos de un material.' })
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Cambia el estado de ciclo de vida del material.' })
  transition(@Param('id') id: string, @Body() dto: TransitionMaterialDto) {
    return this.service.transition(id, dto.status);
  }

  // ── AVL ────────────────────────────────────────────────────────────────────

  @Get(':id/avl')
  @ApiOperation({ summary: 'Fabricantes aprobados (AVL) del material.' })
  listAvl(@Param('id') id: string) {
    return this.service.listAvl(id);
  }

  @Post(':id/avl')
  @ApiOperation({ summary: 'Agrega un fabricante/MPN aprobado.' })
  addAvl(@Param('id') id: string, @Body() dto: CreateAvlDto) {
    return this.service.addAvl(id, dto);
  }

  @Patch(':id/avl/:avlId')
  @ApiOperation({ summary: 'Actualiza un registro de AVL.' })
  updateAvl(
    @Param('id') id: string,
    @Param('avlId') avlId: string,
    @Body() dto: UpdateAvlDto,
  ) {
    return this.service.updateAvl(id, avlId, dto);
  }

  @Delete(':id/avl/:avlId')
  @ApiOperation({ summary: 'Elimina un registro de AVL.' })
  removeAvl(@Param('id') id: string, @Param('avlId') avlId: string) {
    return this.service.removeAvl(id, avlId);
  }

  // ── Alternates ─────────────────────────────────────────────────────────────

  @Get(':id/alternates')
  @ApiOperation({ summary: 'Materiales alternantes/sustitutos.' })
  listAlternates(@Param('id') id: string) {
    return this.service.listAlternates(id);
  }

  @Post(':id/alternates')
  @ApiOperation({ summary: 'Agrega un material alternante/sustituto.' })
  addAlternate(@Param('id') id: string, @Body() dto: CreateMaterialAltDto) {
    return this.service.addAlternate(id, dto);
  }

  @Delete(':id/alternates/:altId')
  @ApiOperation({ summary: 'Elimina un alternante.' })
  removeAlternate(@Param('id') id: string, @Param('altId') altId: string) {
    return this.service.removeAlternate(id, altId);
  }
}
