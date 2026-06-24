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
import { QuotesService } from './services/quotes.service';
import {
  CreateQuoteDto,
  CreateQuoteLineDto,
  UpdateQuoteDto,
  UpdateQuoteLineDto,
} from './dto/quote.dto';
import { QuoteStatus } from './entities/crm-quote.entity';

@ApiTags('CRM · Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/quotes')
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista cotizaciones (filtros: accountId, status).' })
  list(@Query('accountId') accountId?: string, @Query('status') status?: string) {
    return this.service.list({ accountId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Cotización con sus líneas.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Crea una cotización (folio QT-).' })
  create(@Body() dto: CreateQuoteDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Actualiza la cabecera y recalcula.' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/transition')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Cambia el estatus (DRAFT→SENT→ACCEPTED/REJECTED).' })
  transition(@Param('id') id: string, @Body() body: { status: QuoteStatus }) {
    return this.service.transition(id, body.status);
  }

  @Post(':id/lines')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Agrega una línea a la cotización.' })
  addLine(@Param('id') id: string, @Body() dto: CreateQuoteLineDto) {
    return this.service.addLine(id, dto);
  }

  @Patch('lines/:lineId')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Actualiza una línea.' })
  updateLine(@Param('lineId') lineId: string, @Body() dto: UpdateQuoteLineDto) {
    return this.service.updateLine(lineId, dto);
  }

  @Delete('lines/:lineId')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Elimina una línea.' })
  removeLine(@Param('lineId') lineId: string) {
    return this.service.removeLine(lineId);
  }
}
