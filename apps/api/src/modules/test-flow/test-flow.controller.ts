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
import { TestFlowService } from './test-flow.service';
import { EnqueueUnitDto } from './dto/test-flow.dto';

@ApiTags('Test Flow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('test-flow')
export class TestFlowController {
  constructor(private readonly service: TestFlowService) {}

  @Get('queue')
  @RequirePermissions('production:read')
  @ApiOperation({
    summary: 'Cola de unidades por etapa (default: AWAITING_TEST).',
  })
  queue(@Query('stage') stage?: string) {
    return this.service.getQueue({ stage });
  }

  @Get('summary')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Conteos por etapa del flujo de unidades.' })
  summary() {
    return this.service.summary();
  }

  @Get('trace/:serial')
  @RequirePermissions('production:read')
  @ApiOperation({ summary: 'Trazabilidad punta a punta de un serial.' })
  trace(@Param('serial') serial: string) {
    return this.service.trace(serial);
  }

  @Post('enqueue')
  @RequirePermissions('production:write')
  @ApiOperation({
    summary: 'Encola manualmente un serial para Pruebas (ops/backfill).',
  })
  enqueue(@Body() dto: EnqueueUnitDto) {
    return this.service.enqueueFromAssembly({
      serialNumber: dto.serialNumber,
      workOrder: dto.workOrder,
      executionId: dto.executionId,
      model: dto.model,
      station: dto.station,
      programId: dto.programId,
    });
  }
}
