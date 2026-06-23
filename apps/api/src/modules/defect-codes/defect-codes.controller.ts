import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DefectCodesService } from './defect-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

/**
 * CRUD del catálogo de códigos de defecto. Mismo patrón de seguridad que el resto
 * de calidad: la lectura requiere sesión; la escritura, QUALITY_WRITE.
 */
@ApiTags('Quality · Defect Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quality/defect-codes')
export class DefectCodesController {
  constructor(private readonly service: DefectCodesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista el catálogo de códigos de defecto.' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @RequirePermissions('QUALITY_WRITE')
  @ApiOperation({ summary: 'Crea un código de defecto.' })
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('QUALITY_WRITE')
  @ApiOperation({
    summary: 'Edita un código de defecto (incluye activar/desactivar).',
  })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(Number(id), dto);
  }
}
