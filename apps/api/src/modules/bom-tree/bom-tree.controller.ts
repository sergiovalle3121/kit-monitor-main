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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { BomTreeService } from './bom-tree.service';
import {
  CreateBomLineDto,
  CreateBomNodeDto,
  TransitionBomNodeDto,
  UpdateBomLineDto,
  UpdateBomNodeDto,
} from './dto/bom.dto';

/**
 * Multi-level BOM (Engineering). BOM headers (`bom_node`) per assembly material +
 * component lines (`bom_line`) referencing the material master — never free text.
 * Real explosion (multilevel tree + rolled-up qty/cost) and where-used.
 */
@ApiTags('BOM Multinivel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bom-tree')
export class BomTreeController {
  constructor(private readonly service: BomTreeService) {}

  // Nodes
  @Get()
  @ApiOperation({ summary: 'Lista BOMs (headers por ensamble).' })
  listNodes(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.listNodes({ search, status });
  }

  @Get('where-used/:materialId')
  @ApiOperation({ summary: 'En qué ensambles aparece un material (multinivel).' })
  whereUsed(@Param('materialId') materialId: string) {
    return this.service.whereUsed(materialId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un BOM con sus líneas.' })
  getNode(@Param('id') id: string) {
    return this.service.getNode(id);
  }

  @Get(':id/explode')
  @ApiOperation({ summary: 'Explota el BOM (árbol multinivel + cantidades/costo).' })
  explode(@Param('id') id: string, @Query('qty') qty?: string) {
    return this.service.explode(id, qty ? Number(qty) : undefined);
  }

  @Post()
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Crea un BOM para un material/ensamble.' })
  createNode(@Body() dto: CreateBomNodeDto) {
    return this.service.createNode(dto);
  }

  @Patch(':id')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Actualiza el header del BOM.' })
  updateNode(@Param('id') id: string, @Body() dto: UpdateBomNodeDto) {
    return this.service.updateNode(id, dto);
  }

  @Post(':id/transition')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Cambia el estado del BOM (DRAFT/ACTIVE/OBSOLETE).' })
  transitionNode(@Param('id') id: string, @Body() dto: TransitionBomNodeDto) {
    return this.service.transitionNode(id, dto.status);
  }

  @Delete(':id')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Elimina el BOM y sus líneas.' })
  deleteNode(@Param('id') id: string) {
    return this.service.deleteNode(id);
  }

  // Lines
  @Post(':id/lines')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Agrega una línea (componente del maestro).' })
  addLine(@Param('id') id: string, @Body() dto: CreateBomLineDto) {
    return this.service.addLine(id, dto);
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Actualiza una línea del BOM.' })
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBomLineDto,
  ) {
    return this.service.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Elimina una línea del BOM.' })
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.service.removeLine(id, lineId);
  }
}
