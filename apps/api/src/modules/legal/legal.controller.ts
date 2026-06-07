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
import { LegalService } from './legal.service';
import {
  CreateContractDto,
  TransitionContractDto,
  UpdateContractDto,
} from './dto/legal.dto';

@ApiTags('Legal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('legal')
export class LegalController {
  constructor(private readonly service: LegalService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de contratos: activos, por vencer, valor.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('contracts')
  @ApiOperation({ summary: 'Lista contratos (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('counterparty') counterparty?: string,
  ) {
    return this.service.list({ status, type, counterparty });
  }

  @Get('contracts/:id')
  @ApiOperation({ summary: 'Detalle de un contrato.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('contracts')
  @ApiOperation({ summary: 'Crea un contrato (folio CON-).' })
  create(@Body() dto: CreateContractDto) {
    return this.service.create(dto);
  }

  @Patch('contracts/:id')
  @ApiOperation({ summary: 'Actualiza un contrato.' })
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.service.update(id, dto);
  }

  @Post('contracts/:id/transition')
  @ApiOperation({ summary: 'Avanza el contrato por su máquina de estados.' })
  transition(@Param('id') id: string, @Body() dto: TransitionContractDto) {
    return this.service.transition(id, dto);
  }
}
