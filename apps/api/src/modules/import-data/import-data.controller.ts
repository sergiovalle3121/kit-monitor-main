import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ImportDataService } from './import-data.service';
import { CommitImportDto, PreviewImportDto } from './dto/import.dto';
import { IMPORT_TARGETS, ImportTarget } from './import-logic';

/**
 * Data import (the SAP migration). Maps columns from CSV/Excel (parsed file),
 * SQL staging rows, or an IDoc/API feed (skeleton) onto Material Master, BOM
 * (multilevel) and Routing. Validate → preview → confirm, with per-row errors.
 */
@ApiTags('Importación de Datos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('import-data')
export class ImportDataController {
  constructor(private readonly service: ImportDataService) {}

  private assertTarget(target: string): ImportTarget {
    if (!(IMPORT_TARGETS as string[]).includes(target)) {
      throw new BadRequestException(`Destino inválido: ${target}.`);
    }
    return target as ImportTarget;
  }

  @Get('fields/:target')
  @ApiOperation({ summary: 'Campos destino mapeables para un tipo de import.' })
  fields(@Param('target') target: string) {
    return this.service.fields(this.assertTarget(target));
  }

  @Post('suggest')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Sugiere el mapeo de columnas a partir de los encabezados.' })
  suggest(@Body() body: { target: string; headers: string[] }) {
    return this.service.suggest(this.assertTarget(body?.target), body?.headers ?? []);
  }

  @Get('capabilities')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Matriz de cobertura real del carril SAP/import-data.' })
  capabilities() {
    return this.service.capabilities();
  }

  @Post('preview')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Previsualiza y valida (sin persistir) por fila.' })
  preview(@Body() dto: PreviewImportDto) {
    return this.service.preview(dto);
  }

  @Post('commit')
  @RequirePermissions('engineering:write')
  @ApiOperation({ summary: 'Importa las filas válidas (idempotente) y reporta errores.' })
  commit(@Body() dto: CommitImportDto) {
    return this.service.commit(dto);
  }
}
