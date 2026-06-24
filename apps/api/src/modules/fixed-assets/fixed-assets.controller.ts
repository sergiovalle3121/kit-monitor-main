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
import { FixedAssetsService } from './fixed-assets.service';
import {
  CreateFixedAssetDto,
  DisposeFixedAssetDto,
} from './dto/fixed-assets.dto';

@ApiTags('Fixed Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fixed-assets')
export class FixedAssetsController {
  constructor(private readonly service: FixedAssetsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs: costo, valor en libros, depreciación acumulada.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista activos fijos (con depreciación derivada).' })
  list(
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.service.list({ status, category });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un activo fijo.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @RequirePermissions('finance:write')
  @ApiOperation({ summary: 'Capitaliza un activo fijo (folio FA-).' })
  create(@Body() dto: CreateFixedAssetDto) {
    return this.service.create(dto);
  }

  @Post(':id/dispose')
  @RequirePermissions('finance:write')
  @ApiOperation({ summary: 'Da de baja un activo fijo.' })
  dispose(@Param('id') id: string, @Body() dto: DisposeFixedAssetDto) {
    return this.service.dispose(id, dto);
  }
}
