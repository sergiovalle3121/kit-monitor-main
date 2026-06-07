import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DocumentNumberingService } from './document-numbering.service';
import {
  AllocateDto,
  CreateSequenceDto,
  UpdateSequenceDto,
} from './dto/numbering.dto';

@ApiTags('Numbering')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('numbering')
export class NumberingController {
  constructor(private readonly numbering: DocumentNumberingService) {}

  @Get('sequences')
  @ApiOperation({ summary: 'Lista las secuencias de folios del alcance actual.' })
  list() {
    return this.numbering.list();
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Indicadores de numeración (tipos, folios emitidos).' })
  kpis() {
    return this.numbering.kpis();
  }

  @Get('sequences/:docType')
  @ApiOperation({ summary: 'Obtiene la configuración de un tipo de documento.' })
  getByType(@Param('docType') docType: string) {
    return this.numbering.getByType(docType);
  }

  @Get('sequences/:docType/preview')
  @ApiOperation({ summary: 'Previsualiza el siguiente folio sin consumirlo.' })
  preview(@Param('docType') docType: string) {
    return this.numbering.preview(docType);
  }

  @Post('sequences')
  @RequirePermissions('MANAGE_MASTER_DATA')
  @ApiOperation({ summary: 'Crea una secuencia de folios (datos maestros).' })
  create(@Body() dto: CreateSequenceDto) {
    return this.numbering.create(dto);
  }

  @Patch('sequences/:id')
  @RequirePermissions('MANAGE_MASTER_DATA')
  @ApiOperation({ summary: 'Actualiza la configuración de una secuencia.' })
  update(@Param('id') id: string, @Body() dto: UpdateSequenceDto) {
    return this.numbering.update(id, dto);
  }

  @Post('allocate')
  @RequirePermissions('MANAGE_MASTER_DATA')
  @ApiOperation({ summary: 'Reserva y devuelve el/los siguiente(s) folio(s).' })
  async allocate(@Body() dto: AllocateDto) {
    const numbers = await this.numbering.allocateBlock(dto.docType, dto.count ?? 1);
    return { docType: dto.docType.toUpperCase().trim(), numbers, count: numbers.length };
  }
}
