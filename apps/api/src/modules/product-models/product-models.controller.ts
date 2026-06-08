import {
  Body,
  Controller,
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
import { ProductModelsService } from './product-models.service';
import {
  CreateProductModelDto,
  UpdateProductModelDto,
} from './dto/product-model.dto';

/**
 * Product/Model master (NPI · Engineering). The canonical record every
 * downstream area references instead of free-text model strings.
 */
@ApiTags('Product Models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('product-models')
export class ProductModelsController {
  constructor(private readonly service: ProductModelsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista modelos (con búsqueda y filtro de estado).' })
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.list({ search, status });
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Conteos por estado del maestro de modelos.' })
  kpis() {
    return this.service.kpis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un modelo.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un modelo (asigna folio MDL- si no se da uno).' })
  create(@Body() dto: CreateProductModelDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza los datos de un modelo.' })
  update(@Param('id') id: string, @Body() dto: UpdateProductModelDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activa el modelo (DRAFT/OBSOLETE → ACTIVE).' })
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Post(':id/obsolete')
  @ApiOperation({ summary: 'Marca el modelo como obsoleto.' })
  obsolete(@Param('id') id: string) {
    return this.service.obsolete(id);
  }
}
