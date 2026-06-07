import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ControlTowerService } from './control-tower.service';

@ApiTags('Control Tower')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('control-tower')
export class ControlTowerController {
  constructor(private readonly service: ControlTowerService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen ejecutivo cross-área con semáforos y KPIs clave.',
  })
  summary() {
    return this.service.summary();
  }
}
