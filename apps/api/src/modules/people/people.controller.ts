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
import { PeopleService } from './people.service';
import {
  CreateCertificationDto,
  UpdateCertificationDto,
} from './dto/people.dto';

@ApiTags('People')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('people')
export class PeopleController {
  constructor(private readonly service: PeopleService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de skills: válidas, por vencer, cobertura.' })
  kpis() {
    return this.service.kpis();
  }

  @Get('certification-check')
  @ApiOperation({
    summary:
      'Gate operador↔estación (read-only): ¿el operador tiene certificación vigente para la estación? Sólo advierte, no bloquea.',
  })
  certificationCheck(
    @Query('employeeId') employeeId?: string,
    @Query('employee') employee?: string,
    @Query('station') station?: string,
  ) {
    return this.service.certificationCheck({ employeeId, employee, station });
  }

  @Get('certifications')
  @ApiOperation({ summary: 'Lista certificaciones (con estatus derivado).' })
  list(
    @Query('skill') skill?: string,
    @Query('employeeName') employeeName?: string,
    @Query('area') area?: string,
  ) {
    return this.service.list({ skill, employeeName, area });
  }

  @Get('certifications/:id')
  @ApiOperation({ summary: 'Detalle de una certificación.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post('certifications')
  @ApiOperation({ summary: 'Registra una certificación de empleado.' })
  create(@Body() dto: CreateCertificationDto) {
    return this.service.create(dto);
  }

  @Patch('certifications/:id')
  @ApiOperation({ summary: 'Actualiza / recertifica (nueva fecha de expiración).' })
  update(@Param('id') id: string, @Body() dto: UpdateCertificationDto) {
    return this.service.update(id, dto);
  }
}
