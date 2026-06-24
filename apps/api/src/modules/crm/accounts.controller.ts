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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AccountsService } from './services/accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@ApiTags('CRM · Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de cartera de cuentas (tier, región, salud).' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista de cuentas (búsqueda + filtros).' })
  list(
    @Query('q') q?: string,
    @Query('tier') tier?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ q, tier, type, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle simple de la cuenta.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Get(':id/360')
  @ApiOperation({ summary: 'Vista 360: contactos, oportunidades, cotizaciones, actividades y métricas.' })
  account360(@Param('id') id: string) {
    return this.service.account360(id);
  }

  @Post()
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Crea una cuenta comercial.' })
  create(@Body() dto: CreateAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Actualiza una cuenta.' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.service.update(id, dto);
  }
}
