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
import { CrmService } from './crm.service';
import {
  CreateOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto,
} from './dto/crm.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de pipeline: valor, ponderado, win-rate.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('opportunities')
  @ApiOperation({ summary: 'Lista oportunidades (con filtros).' })
  list(
    @Query('status') status?: string,
    @Query('customerName') customerName?: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.service.list({ status, customerName, accountId });
  }

  @Get('opportunities/:id')
  @ApiOperation({ summary: 'Detalle de una oportunidad.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('opportunities')
  @ApiOperation({ summary: 'Crea una oportunidad (folio OPP-).' })
  create(@Body() dto: CreateOpportunityDto) {
    return this.service.create(dto);
  }

  @Patch('opportunities/:id')
  @ApiOperation({ summary: 'Actualiza una oportunidad.' })
  update(@Param('id') id: string, @Body() dto: UpdateOpportunityDto) {
    return this.service.update(id, dto);
  }

  @Post('opportunities/:id/transition')
  @ApiOperation({ summary: 'Avanza la oportunidad por el pipeline.' })
  transition(@Param('id') id: string, @Body() dto: TransitionOpportunityDto) {
    return this.service.transition(id, dto);
  }
}
